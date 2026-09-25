import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js'
import type { LucideIcon } from 'lucide-react'
import {
  CircleAlert,
  CircleCheck,
  Database,
  FileText,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Toaster, toast } from 'sonner'
import CandidateRanking from './components/CandidateRanking'
import Header, { type HeaderStatus } from './components/Header'
import JobOfferInput from './components/JobOfferInput'
import ResumeUploader from './components/ResumeUploader'
import { toCVInputs, usePdfParser, type ParsedPdf } from './hooks/usePdfParser'
import { useTheme } from './hooks/useTheme'
import { supabase } from './lib/supabaseClient'
import type { AnalyzeResponse, CVAnalysis } from './types'

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Cmd+Enter on macOS, Ctrl+Enter elsewhere (rendered inside the CTA). */
const IS_APPLE =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

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

/** Client-side phases of an analysis run (drives the live checklist). */
type Phase = 'idle' | 'extracting' | 'analyzing' | 'finalizing'

interface Step {
  label: string
  icon: LucideIcon
}

const STEPS: Step[] = [
  { label: 'Extracción de texto con PDF.js', icon: FileText },
  { label: 'Análisis con Gemini', icon: Sparkles },
  { label: 'Guardado en Supabase', icon: Database },
]

type StepState = 'done' | 'active' | 'pending'

function StepRow({
  step,
  state,
  detail,
}: {
  step: Step
  state: StepState
  detail?: string
}) {
  const Icon = step.icon

  return (
    <li
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
        state === 'active'
          ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10'
          : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50'
      }`}
    >
      <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center">
        {state === 'done' ? (
          <CircleCheck className="anim-pop h-5 w-5 text-emerald-500" />
        ) : state === 'active' ? (
          <LoaderCircle className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
        ) : (
          <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        )}
      </span>
      <span
        className={`min-w-0 truncate text-sm ${
          state === 'active'
            ? 'font-medium text-slate-900 dark:text-slate-100'
            : state === 'done'
              ? 'text-slate-600 dark:text-slate-300'
              : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        {step.label}
      </span>
      {detail && (
        <span className="ml-auto shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {detail}
        </span>
      )}
    </li>
  )
}

function FileRow({ item }: { item: ParsedPdf }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span aria-hidden="true" className="grid h-4 w-4 shrink-0 place-items-center">
        {item.status === 'success' ? (
          <CircleCheck className="anim-pop h-4 w-4 text-emerald-500" />
        ) : item.status === 'error' ? (
          <CircleAlert className="h-4 w-4 text-rose-500" />
        ) : item.status === 'processing' ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-indigo-500" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">
        {item.fileName}
      </span>
      <span
        className="max-w-[45%] shrink-0 truncate text-right text-slate-500 dark:text-slate-400"
        title={item.error ?? undefined}
      >
        {item.status === 'error'
          ? item.error
          : item.status === 'success' && item.pageCount !== null
            ? `${item.pageCount} pág.`
            : item.status === 'processing'
              ? 'leyendo…'
              : 'en cola'}
      </span>
    </li>
  )
}

function App() {
  const [jobOffer, setJobOffer] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<CVAnalysis[] | null>(null)

  const { theme, toggleTheme } = useTheme()
  const { items, parseFiles } = usePdfParser()

  const isAnalyzing = phase !== 'idle'

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

    try {
      // 1. Extract text from the PDFs (pdf.js, in the browser) — real per-file progress.
      setPhase('extracting')
      const parsed = await parseFiles(files)
      const cvs = toCVInputs(parsed)
      const skipped = parsed.filter((item) => item.status === 'error')

      if (cvs.length === 0) {
        const details = skipped.map((item) => `${item.fileName}: ${item.error}`).join(' · ')
        throw new Error(`No se pudo extraer texto de los PDF. ${details}`)
      }

      // 2. Call the analyze-resumes Edge Function (Gemini + insert in DB).
      setPhase('analyzing')
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

      // 3. The function only answers once the rows are saved: let the last
      //    checkmark paint before swapping the panel for the results.
      setPhase('finalizing')
      await sleep(450)

      setResults(data.analyses)
      toast.success('Análisis completado', {
        description: `${data.analyses.length} candidatos puntuados`,
      })
      if (skipped.length > 0) {
        toast.warning(
          `${skipped.length} ${skipped.length === 1 ? 'PDF omitido' : 'PDF omitidos'}`,
          { description: skipped.map((item) => item.fileName).join(', ') },
        )
      }
    } catch (err) {
      const message = toMessage(err)
      console.error('analyze-resumes run failed:', err)
      setError(message)
      toast.error('No se pudo completar el análisis', {
        description: message.length > 140 ? `${message.slice(0, 140)}…` : message,
        action: { label: 'Reintentar', onClick: () => void handleAnalyze() },
      })
    } finally {
      setPhase('idle')
    }
  }

  const handleClearResults = () => {
    setResults(null)
    setError(null)
  }

  // Keep a ref to the latest run so the global shortcut never calls a stale closure.
  const analyzeRef = useRef<() => void>(() => {})
  useEffect(() => {
    analyzeRef.current = handleAnalyze
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        analyzeRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Which checklist step is live: 0 extracting, 1 Gemini, 3 = everything done.
  const currentStep =
    phase === 'extracting' ? 0 : phase === 'analyzing' ? 1 : phase === 'finalizing' ? 3 : 0
  const stepState = (index: number): StepState =>
    index < currentStep ? 'done' : index === currentStep ? 'active' : 'pending'

  const extractedCount = items.filter((item) => item.status === 'success').length
  const phaseHint =
    phase === 'extracting'
      ? 'Extrayendo el texto de los PDF en tu navegador.'
      : phase === 'analyzing'
        ? 'Enviando la oferta y los currículums a Gemini…'
        : '¡Listo! Preparando el ranking…'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <Header status={status} theme={theme} onToggleTheme={toggleTheme} />
      <Toaster theme={theme} position="top-right" richColors closeButton />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <JobOfferInput value={jobOffer} onChange={setJobOffer} />

        <ResumeUploader files={files} onFilesChange={setFiles} disabled={isAnalyzing} />

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            El texto se extrae en tu navegador con PDF.js · el análisis lo realiza Gemini Flash
            a través de la Edge Function <code className="font-mono">analyze-resumes</code>.
          </p>

          <div className="flex shrink-0 gap-2">
            {results && !isAnalyzing && (
              <button
                type="button"
                onClick={handleClearResults}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Limpiar
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleAnalyze()}
              disabled={isAnalyzing}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none dark:bg-indigo-500 dark:hover:bg-indigo-400"
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
                  <kbd
                    title="Atajo de teclado"
                    className="ml-1 hidden rounded border border-white/25 bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide sm:inline-block"
                  >
                    {IS_APPLE ? '⌘↵' : 'Ctrl↵'}
                  </kbd>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Loading state: live checklist driven by the real phases */}
        {isAnalyzing && (
          <section
            aria-live="polite"
            className="anim-fade rounded-xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-6 dark:border-indigo-500/20 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3">
              <LoaderCircle
                aria-hidden="true"
                className="h-6 w-6 shrink-0 animate-spin text-indigo-600 dark:text-indigo-400"
              />
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg leading-tight font-semibold tracking-tight text-slate-900 sm:text-xl dark:text-slate-50">
                  Analizando currículums…
                </h2>
                <p className="truncate text-xs text-slate-500 sm:text-sm dark:text-slate-400">
                  {phaseHint}
                </p>
              </div>
            </div>

            <ol className="mt-4 space-y-2">
              {STEPS.map((step, index) => (
                <StepRow
                  key={step.label}
                  step={step}
                  state={stepState(index)}
                  detail={
                    index === 0 && phase !== 'finalizing' && items.length > 0
                      ? `${extractedCount}/${items.length}`
                      : undefined
                  }
                />
              ))}
            </ol>

            {phase === 'extracting' && items.length > 0 && (
              <div
                aria-hidden="true"
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
              >
                <div
                  className="h-full rounded-full bg-indigo-500 transition-[width] duration-500"
                  style={{ width: `${(extractedCount / items.length) * 100}%` }}
                />
              </div>
            )}

            {items.length > 0 && (
              <ul className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                {items.map((item) => (
                  <FileRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Results */}
        {!isAnalyzing && results && <CandidateRanking analyses={results} />}

        {!isAnalyzing && !results && !error && (
          <section className="anim-fade rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center sm:p-10 dark:border-slate-700 dark:bg-slate-900/50">
            <span
              aria-hidden="true"
              className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-indigo-50 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-400"
            >
              <UserCheck className="h-6 w-6" />
            </span>
            <h2 className="mt-3 font-display text-lg leading-tight font-semibold tracking-tight text-slate-700 sm:text-xl dark:text-slate-200">
              Aún no hay resultados
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-slate-400">
              Carga una oferta de trabajo y hasta 5 CV en PDF. Al analizarlos verás aquí el
              ranking de candidatos con sus puntuaciones, fit cultural y preguntas de entrevista.
            </p>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <p className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-slate-500 sm:px-6 dark:text-slate-400">
          RecruiterAI · React + Vite + Supabase + Gemini Flash
        </p>
      </footer>
    </div>
  )
}

export default App
