import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// NOTE: `corsHeaders` is declared inline (instead of importing "../_shared/cors.ts")
// so this exact file can be pasted as-is into the Supabase Dashboard editor, which
// does not bundle local imports.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CVInput {
  id: string;
  text: string;
  fileName?: string;
}

interface RequestPayload {
  jobOffer: string;
  cvs: CVInput[];
}

interface ContactInfo {
  name: string;
  email: string;
  phone?: string;
  linkedin?: string;
  location?: string;
}

interface CVAnalysis {
  cvId: string;
  contactInfo: ContactInfo;
  scores: {
    overall: number;
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
    keywordsMatch: number;
  };
  strengths: string[];
  weaknesses: string[];
  summary: string;
  culturalFit: {
    score: number;
    assessment: string;
    softSkills: string[];
  };
  interviewQuestions: string[];
  recommended: boolean;
}

interface GeminiResponse {
  analyses: CVAnalysis[];
}

// Default model; override it with the optional `GEMINI_MODEL` Edge Function secret so a
// model retirement (like gemini-2.0-flash in June 2026) never requires a redeploy.
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

function geminiGenerateUrl(apiKey: string): string {
  const model = Deno.env.get("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

function buildPrompt(jobOffer: string, cvs: CVInput[]): string {
  const cvsText = cvs.map((cv, index) => 
    `--- CV ${index + 1} (ID: ${cv.id}) ---\n${cv.text}`
  ).join("\n\n");

  return `
Eres un experto en reclutamiento y análisis de currículums. Analiza los siguientes CVs contra la oferta de trabajo proporcionada.

OFERTA DE TRABAJO:
${jobOffer}

CURRÍCULUMS A ANALIZAR:
${cvsText}

INSTRUCCIONES:
1. Para cada CV, extrae la información de contacto (nombre, email, teléfono, LinkedIn, ubicación)
2. Evalúa cada CV en una escala de 0-100 en: 
   - overall: puntuación general
   - skillsMatch: coincidencia de habilidades técnicas
   - experienceMatch: coincidencia de experiencia laboral
   - educationMatch: coincidencia de formación académica
   - keywordsMatch: coincidencia de palabras clave de la oferta
3. Identifica 3-5 fortalezas y 3-5 debilidades por CV
4. Escribe un resumen ejecutivo de 2-3 frases
5. Determina si se recomienda al candidato (true/false)
6. Evalúa el fit cultural (culturalFit) en una escala de 0-100 (score): coherencia con
   la forma de trabajo descrita en la oferta, ritmo, colaboración y valores. Incluye una
   valoración breve (assessment, 1-2 frases) y 3-5 soft skills observadas (softSkills)
7. Propón 4-6 preguntas de entrevista personalizadas para ese candidato (interviewQuestions),
   dirigidas a verificar sus puntos fuertes y aclarar sus carencias

RESPONDE EXCLUSIVAMENTE CON UN JSON VÁLIDO SIGUIENDO ESTE ESQUEMA:
{
  "analyses": [
    {
      "cvId": "string",
      "contactInfo": {
        "name": "string",
        "email": "string",
        "phone": "string|null",
        "linkedin": "string|null",
        "location": "string|null"
      },
      "scores": {
        "overall": number,
        "skillsMatch": number,
        "experienceMatch": number,
        "educationMatch": number,
        "keywordsMatch": number
      },
      "strengths": ["string"],
      "weaknesses": ["string"],
      "summary": "string",
      "culturalFit": {
        "score": number,
        "assessment": "string",
        "softSkills": ["string"]
      },
      "interviewQuestions": ["string"],
      "recommended": boolean
    }
  ]
}

NO INCLUYAS NINGÚN TEXTO ADICIONAL, MARKDOWN, NI EXPLICACIONES. SOLO EL JSON.
`;
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

// Upstream statuses worth retrying: rate limits and transient capacity spikes.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503]);
const MAX_GEMINI_ATTEMPTS = 3;
// Waits before the 2nd and 3rd attempt (total added wait: 4s).
const RETRY_DELAYS_MS = [1_000, 3_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Turn a successful Gemini payload into a GeminiResponse (never retried: deterministic). */
function parseGeminiResponse(data: any): GeminiResponse {
  const candidate = data.candidates?.[0];
  if (!candidate) {
    const blockReason = data.promptFeedback?.blockReason;
    throw new Error(
      `Gemini returned no candidate${blockReason ? ` (blockReason: ${blockReason})` : ""}`,
    );
  }

  // Gemini 3.x may prepend its reasoning as parts flagged `thought: true`; those must
  // never be parsed as the answer. The JSON itself can be split across several parts.
  const parts: GeminiPart[] = Array.isArray(candidate.content?.parts)
    ? candidate.content.parts
    : [];
  const jsonText = parts
    .filter((part) => part.thought !== true && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("");

  if (!jsonText) {
    throw new Error(`Gemini returned no usable text (finishReason: ${candidate.finishReason ?? "unknown"})`);
  }

  try {
    return JSON.parse(jsonText);
  } catch (parseError) {
    if (candidate.finishReason === "MAX_TOKENS") {
      throw new Error(
        "Gemini truncated the response before finishing the JSON (finishReason: MAX_TOKENS)",
      );
    }
    const detail = parseError instanceof Error ? parseError.message : String(parseError);
    throw new Error(`Failed to parse Gemini response as JSON: ${detail}`);
  }
}

async function callGeminiAPI(prompt: string, apiKey: string): Promise<GeminiResponse> {
  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      topK: 32,
      topP: 0.95,
      // Gemini 3.x spends output tokens on reasoning before answering, so the
      // JSON budget has to be larger than the answer itself.
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
    },
  });

  let lastError: Error = new Error("Gemini API error: no attempt was made");

  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt++) {
    const retryDelay = RETRY_DELAYS_MS[attempt - 1] ?? 3_000;

    // 1) The HTTP call itself can fail (DNS, reset, aborted connection) — retry it.
    let response: Response;
    try {
      response = await fetch(geminiGenerateUrl(apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
    } catch (networkError) {
      const detail = networkError instanceof Error ? networkError.message : String(networkError);
      lastError = new Error(`Gemini API network error: ${detail}`);
      if (attempt < MAX_GEMINI_ATTEMPTS) {
        console.warn(`${lastError.message} (attempt ${attempt}/${MAX_GEMINI_ATTEMPTS}); retrying in ${retryDelay}ms`);
        await sleep(retryDelay);
        continue;
      }
      break;
    }

    // 2) Retryable HTTP statuses, e.g. Google's "high demand" 503 spikes.
    if (!response.ok) {
      const errorText = await response.text();
      lastError = new Error(`Gemini API error: ${response.status} - ${errorText}`);
      const canRetry = RETRYABLE_STATUSES.has(response.status) && attempt < MAX_GEMINI_ATTEMPTS;
      if (canRetry) {
        console.warn(`${lastError.message} (attempt ${attempt}/${MAX_GEMINI_ATTEMPTS}); retrying in ${retryDelay}ms`);
        await sleep(retryDelay);
        continue;
      }
      // Non-retryable status (404 model, 400 params, 401 key…) or attempts exhausted.
      throw lastError;
    }

    // 3) Success: parsing happens outside the retry loop — parse failures are
    //    deterministic, retrying them would only burn the client's 120s budget.
    return parseGeminiResponse(await response.json());
  }

  throw lastError;
}

async function saveAnalysesToDatabase(
  supabase: ReturnType<typeof createClient>,
  jobOfferId: string,
  analyses: CVAnalysis[]
): Promise<void> {
  const records = analyses.map((analysis) => ({
    job_offer_id: jobOfferId,
    cv_id: analysis.cvId,
    contact_name: analysis.contactInfo.name,
    contact_email: analysis.contactInfo.email,
    contact_phone: analysis.contactInfo.phone,
    contact_linkedin: analysis.contactInfo.linkedin,
    contact_location: analysis.contactInfo.location,
    score_overall: analysis.scores.overall,
    score_skills_match: analysis.scores.skillsMatch,
    score_experience_match: analysis.scores.experienceMatch,
    score_education_match: analysis.scores.educationMatch,
    score_keywords_match: analysis.scores.keywordsMatch,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    summary: analysis.summary,
    cultural_fit_score: Math.min(100, Math.max(0, Math.round(analysis.culturalFit?.score ?? analysis.scores.overall))),
    cultural_fit_assessment: analysis.culturalFit?.assessment ?? "",
    soft_skills: analysis.culturalFit?.softSkills ?? [],
    interview_questions: analysis.interviewQuestions ?? [],
    recommended: analysis.recommended,
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("cv_analyses").insert(records);
  
  if (error) {
    throw new Error(`Database insert error: ${error.message}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY environment variable not set");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: RequestPayload = await req.json();
    
    if (!payload.jobOffer || !payload.cvs || payload.cvs.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: jobOffer and cvs array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(payload.jobOffer, payload.cvs);
    const geminiResult = await callGeminiAPI(prompt, geminiApiKey);

    const jobOfferId = crypto.randomUUID();
    
    await saveAnalysesToDatabase(supabase, jobOfferId, geminiResult.analyses);

    return new Response(
      JSON.stringify({
        success: true,
        jobOfferId,
        analyses: geminiResult.analyses,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-resumes:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});