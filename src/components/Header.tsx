import { Moon, Sparkles, Sun } from 'lucide-react'
import type { Theme } from '../hooks/useTheme'

/** High-level state of the application, shown in the header. */
export type HeaderStatus = 'idle' | 'processing' | 'success' | 'error'

export interface HeaderProps {
  status?: HeaderStatus
  /** Current colour theme (drives the sun/moon icon). */
  theme?: Theme
  /** Toggles between light and dark mode. */
  onToggleTheme?: () => void
}

const STATUS_CONFIG: Record<
  HeaderStatus,
  { label: string; pill: string; dot: string; pulse: boolean }
> = {
  idle: {
    label: 'En espera',
    pill:
      'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
    dot: 'bg-slate-400',
    pulse: false,
  },
  processing: {
    label: 'Analizando…',
    pill:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    dot: 'bg-amber-500',
    pulse: true,
  },
  success: {
    label: 'Completado',
    pill:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    pulse: false,
  },
  error: {
    label: 'Error',
    pill:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
    dot: 'bg-rose-500',
    pulse: false,
  },
}

export function Header({
  status = 'idle',
  theme = 'light',
  onToggleTheme,
}: HeaderProps) {
  const config = STATUS_CONFIG[status]
  const isDark = theme === 'dark'

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-slate-800 dark:bg-slate-900/85 dark:supports-[backdrop-filter]:bg-slate-900/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm sm:h-10 sm:w-10"
          >
            <Sparkles className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <h1 className="truncate font-display text-xl leading-tight font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50">
              RecruiterAI
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">
              Análisis de currículums potenciado por IA
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium sm:px-3 ${config.pill}`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${config.dot} ${config.pulse ? 'animate-pulse' : ''}`}
            />
            {config.label}
          </span>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
          >
            {isDark ? (
              <Sun aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Moon aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
