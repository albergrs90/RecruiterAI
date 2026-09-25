/**
 * Shared domain types between the frontend, the Edge Function
 * (supabase/functions/analyze-resumes) and the database.
 */

/** Payload for a single CV sent to the analyze-resumes Edge Function. */
export interface CVInput {
  /** Stable client-side id (used to correlate results back to the upload). */
  id: string
  /** Full extracted text of the CV. */
  text: string
  /** Original file name, for display purposes. */
  fileName?: string
}

/** Request body of POST /functions/v1/analyze-resumes */
export interface AnalyzeRequest {
  jobOffer: string
  cvs: CVInput[]
}

export interface ContactInfo {
  name: string
  email: string
  phone?: string | null
  linkedin?: string | null
  location?: string | null
}

/** All scores are integers from 0 to 100. */
export interface Scores {
  overall: number
  skillsMatch: number
  experienceMatch: number
  educationMatch: number
  keywordsMatch: number
}

export interface CulturalFit {
  /** 0-100 */
  score: number
  assessment: string
  softSkills: string[]
}

export interface CVAnalysis {
  cvId: string
  contactInfo: ContactInfo
  scores: Scores
  strengths: string[]
  weaknesses: string[]
  summary: string
  culturalFit: CulturalFit
  interviewQuestions: string[]
  recommended: boolean
}

/** Success response of the analyze-resumes Edge Function. */
export interface AnalyzeResponse {
  success: true
  jobOfferId: string
  analyses: CVAnalysis[]
}

export interface ErrorResponse {
  error: string
}
