import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js'
import { CircleAlert, LoaderCircle, RotateCcw, Sparkles, UserCheck } from 'lucide-react'
import { useState } from 'react'
import CandidateRanking from './components/CandidateRanking'
import Header, { type HeaderStatus } from './components/Header'
import JobOfferInput from './components/JobOfferInput'
import ResumeUploader from './components/ResumeUploader'
import { toCVInputs, usePdfParser } from './hooks/usePdfParser'
import { supabase } from './lib/supabaseClient'
import type { AnalyzeResponse, CVAnalysis } from './types'

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Shape of the bodies our Edge Function and the Supabase gateway return on failure. */
interface ErrorBody {
  error?: unknown
  message?: unknown
  msg?: unknown
}

/** Best-effort: read the body our Edge Function (or the gateway) returns on failure. */
async function readFunctionErrorMessage(error: unknown): Promise<string | null> {
  const context = (error as { context?: Response } | null)?.context
  if (!context || typeof context.text !== 'function') return null

  let raw: string
  try {
    raw = await context.text()
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const body = JSON.parse(raw) as ErrorBody
    for (const key of ['error', 'message', 'msg'] as const) {
      const value = body[key]
      if (typeof value === 'string' && value.length > 0) return value
    }
    return null
  } catch {
    // Non-JSON body (e.g. an HTML error page): surface a trimmed snippet instead.
    return raw.slice(0, 300)
  }
}

/**
 * Turn a `supabase.functions.invoke` error into a message the user can act on.
 *
 * - `FunctionsHttpError`: the function ran and answered non-2xx → show its body.
 * - `FunctionsRelayError`: the Supabase relay could not reach the function.
 * - `FunctionsFetchError`: the request never completed (network/CORS/timeout).
 */
async function describeFunctionsError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const detail = await readFunctionErrorMessage(error)
    if (detail) return detail
    const status = (error.context as Response | undefined)?.status
    return `La Edge Function respondió con error${status ? ` (HTTP ${status})` : ''}. Revisa sus logs en el dashboard de Supabase.`
  }

  if (error instanceof FunctionsRelayError) {
    return 'El relay de Supabase no pudo alcanzar la Edge Function. Comprueba que "analyze-resumes" está desplegada.'
  }

  if (error instanceof FunctionsFetchError) {
    // `context` holds the underlying fetch rejection (AbortError, TypeError, …).
    const cause = error.context as { name?: string } | undefined
    if (cause?.name === 'AbortError' || cause?.name === 'TimeoutError') {
      return 'La petición superó el tiempo límite (2 min). Prueba con menos CV o vuelve a intentarlo.'
    }
    console.error('FunctionsFetchError (network/CORS):', error, cause)
    return 'Error de red o CORS al llamar a la Edge Function. Comprueba que "analyze-resumes" está desplegada y que la verificación JWT está desactivada.'
  }

  return toMessage(error)
}

function App() {
  const [jobOffer, setJobOffer] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<CVAnalysis[] | null>(null)

  const { parseFiles } = usePdfParser()

  const status: HeaderStatus = isAnalyzing
    ? 'processing'
    : error
      ? 'error'
      : results
        ? 'success'
        : 'idle'

  const handleAnalyze = async () => {
    if (isAnalyzing) return
    setError(null)
    setResults(null)

    if (jobOffer.trim().length < 20) {
      setError('Introduce la oferta de trabajo (mínimo 20 caracteres).')
      return
    }
    if (files.length === 0) {
      setError('Sube al menos un currículum en PDF.')
      return
    }

    setIsAnalyzing(true)
    try {
      // 1. Extract text from the PDFs (pdf.js, in the browser).
      const parsed = await parseFiles(files)
      const cvs = toCVInputs(parsed)

      if (cvs.length === 0) {
        const details = parsed
          .filter((item) => item.status === 'error')
          .map((item) => `${item.fileName}: ${item.error}`)
          .join(' · ')
        throw new Error(`No se pudo extraer texto de los PDF. ${details}`)
      }

      // 2. Call the analyze-resumes Edge Function (Gemini Flash + insert in DB).
      const { data, error: fnError } = await supabase.functions.invoke<AnalyzeResponse>(
        'analyze-resumes',
        { body: { jobOffer: jobOffer.trim(), cvs }, timeout: 120_000 },
      )

      if (fnError) {
        console.error('analyze-resumes invocation failed:', fnError)
        const detail = await describeFunctionsError(fnError)
        throw new Error(`La función analyze-resumes falló: ${detail}`)
      }
      if (!data?.analyses?.length) {
        throw new Error('La función analyze-resumes no devolvió resultados.')
      }

      // 3. Render the ranking.
      setResults(data.analyses)
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleClearResults = () => {
    setResults(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Header status={status} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <JobOfferInput value={jobOffer} onChange={setJobOffer} />

        <ResumeUploader files={files} onFilesChange={setFiles} disabled={isAnalyzing} />

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-slate-400">
            El texto se extrae en tu navegador con PDF.js · el análisis lo realiza Gemini Flash
            a través de la Edge Function <code className="font-mono">analyze-resumes</code>.
          </p>

          <div className="flex shrink-0 gap-2">
            {results && !isAnalyzing && (
              <button
                type="button"
                onClick={handleClearResults}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-500/20"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Limpiar
              </button>
            )}

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none"
            >
              {isAnalyzing ? (
                <>
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Analizando…
                </>
              ) : (
                <>
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                  Analizar candidatos
                </>
              )}
            </button>
          </div>
        </div>

        {/* Loading state */}
        {isAnalyzing && (
          <section
            aria-live="polite"
            className="rounded-xl border border-indigo-100 bg-white p-8 text-center shadow-sm sm:p-10"
          >
            <LoaderCircle
              aria-hidden="true"
              className="mx-auto h-10 w-10 animate-spin text-indigo-600"
            />
            <h2 className="mt-4 text-base font-semibold text-slate-900 sm:text-lg">
              Analizando currículums…
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Extrayendo el texto de los PDF y puntuando candidatos con Gemini Flash.
            </p>

            <div
              aria-hidden="true"
              className="mx-auto mt-5 h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-slate-100 sm:w-64"
            >
              <div className="h-full w-1/3 rounded-full bg-indigo-500 animate-[indeterminate_1.6s_ease-in-out_infinite]" />
            </div>

            <ul className="mx-auto mt-6 grid max-w-md gap-2 text-left text-xs text-slate-500 sm:grid-cols-3 sm:text-center">
              <li className="rounded-lg bg-slate-50 px-3 py-2">1. Extracción con PDF.js</li>
              <li className="rounded-lg bg-slate-50 px-3 py-2">2. Análisis con Gemini</li>
              <li className="rounded-lg bg-slate-50 px-3 py-2">3. Guardado en Supabase</li>
            </ul>
          </section>
        )}

        {/* Results */}
        {!isAnalyzing && results && <CandidateRanking analyses={results} />}

        {!isAnalyzing && !results && !error && (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center sm:p-10">
            <span
              aria-hidden="true"
              className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-indigo-50 text-indigo-500"
            >
              <UserCheck className="h-6 w-6" />
            </span>
            <h2 className="mt-3 text-sm font-semibold text-slate-700 sm:text-base">
              Aún no hay resultados
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-400 sm:text-sm">
              Carga una oferta de trabajo y hasta 5 CV en PDF. Al analizarlos verás aquí el
              ranking de candidatos con sus puntuaciones, fit cultural y preguntas de entrevista.
            </p>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <p className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-slate-400 sm:px-6">
          RecruiterAI / SmartMatch HR · React + Vite + Supabase + Gemini Flash
        </p>
      </footer>
    </div>
  )
}

export default App
