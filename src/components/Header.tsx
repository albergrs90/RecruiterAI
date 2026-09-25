import { Sparkles } from 'lucide-react'

/** High-level state of the application, shown in the header. */
export type HeaderStatus = 'idle' | 'processing' | 'success' | 'error'

export interface HeaderProps {
  status?: HeaderStatus
}

const STATUS_CONFIG: Record<
  HeaderStatus,
  { label: string; pill: string; dot: string; pulse: boolean }
> = {
  idle: {
    label: 'En espera',
    pill: 'border-slate-200 bg-slate-50 text-slate-600',
    dot: 'bg-slate-400',
    pulse: false,
  },
  processing: {
    label: 'Analizando…',
    pill: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    pulse: true,
  },
  success: {
    label: 'Completado',
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    pulse: false,
  },
  error: {
    label: 'Error',
    pill: 'border-rose-200 bg-rose-50 text-rose-700',
    dot: 'bg-rose-500',
    pulse: false,
  },
}

export function Header({ status = 'idle' }: HeaderProps) {
  const config = STATUS_CONFIG[status]

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm sm:h-10 sm:w-10"
          >
            <Sparkles className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              RecruiterAI <span className="font-normal text-slate-300">/</span>{' '}
              <span className="font-medium text-slate-500">SmartMatch HR</span>
            </h1>
            <p className="hidden text-xs text-slate-400 sm:block">
              Análisis de currículums potenciado por IA
            </p>
          </div>
        </div>

        <span
          role="status"
          aria-live="polite"
          className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium sm:px-3 ${config.pill}`}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${config.dot} ${config.pulse ? 'animate-pulse' : ''}`}
          />
          {config.label}
        </span>
      </div>
    </header>
  )
}

export default Header
