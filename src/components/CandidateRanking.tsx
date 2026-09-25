import type { CSSProperties } from 'react'
import { Target, Trophy, Users } from 'lucide-react'
import { useCountUp } from '../hooks/useCountUp'
import type { CVAnalysis } from '../types'
import CandidateCard from './CandidateCard'

export interface CandidateRankingProps {
  analyses: CVAnalysis[]
}

export function CandidateRanking({ analyses }: CandidateRankingProps) {
  // Highest score first.
  const ranked = [...analyses].sort((a, b) => b.scores.overall - a.scores.overall)
  const top = ranked[0]
  const hasResults = ranked.length > 0
  const average = hasResults
    ? Math.round(ranked.reduce((sum, analysis) => sum + analysis.scores.overall, 0) / ranked.length)
    : 0
  const recommendedCount = ranked.filter((analysis) => analysis.recommended).length

  // Hooks must run unconditionally: animate each headline number into place.
  const candidateCount = useCountUp(ranked.length, { duration: 700, delay: 0 })
  const topScore = useCountUp(top?.scores.overall ?? 0, { duration: 900, delay: 100 })
  const averageScore = useCountUp(average, { duration: 900, delay: 200 })

  if (!hasResults) return null

  const stats = [
    {
      label: 'Candidatos analizados',
      value: String(Math.round(candidateCount)),
      sub: `${recommendedCount} recomendados`,
      icon: Users,
      tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400',
      highlight: false,
    },
    {
      label: 'Candidato top',
      value: `${Math.round(topScore)}%`,
      sub: top.contactInfo.name,
      icon: Trophy,
      tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
      highlight: true,
    },
    {
      label: 'Puntuación media',
      value: `${Math.round(averageScore)}%`,
      sub: 'de compatibilidad',
      icon: Target,
      tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
      highlight: false,
    },
  ]

  return (
    <section aria-label="Ranking de candidatos" className="space-y-4">
      <div className="anim-fade flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl leading-tight font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50">
          Ranking de candidatos
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Ordenado por puntuación de mayor a menor
        </p>
      </div>

      {/* General metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            style={{ ['--i']: index } as CSSProperties}
            className={`anim-rise flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${
              stat.highlight
                ? 'border-indigo-200 ring-1 ring-indigo-100 dark:border-indigo-500/30 dark:ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <span
              aria-hidden="true"
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${stat.tone}`}
            >
              <stat.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xl font-bold tabular-nums leading-none text-slate-900 dark:text-slate-50">
                {stat.value}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {stat.label}
              </p>
              <p
                className="truncate text-xs text-slate-500 dark:text-slate-400"
                title={stat.sub}
              >
                {stat.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Ranked cards (each card staggers its own entrance via `rank`) */}
      <div className="space-y-4">
        {ranked.map((analysis, index) => (
          <CandidateCard key={analysis.cvId} analysis={analysis} rank={index + 1} />
        ))}
      </div>
    </section>
  )
}

export default CandidateRanking
