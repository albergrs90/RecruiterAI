import { Target, Trophy, Users } from 'lucide-react'
import type { CVAnalysis } from '../types'
import CandidateCard from './CandidateCard'

export interface CandidateRankingProps {
  analyses: CVAnalysis[]
}

export function CandidateRanking({ analyses }: CandidateRankingProps) {
  if (analyses.length === 0) return null

  // Highest score first.
  const ranked = [...analyses].sort((a, b) => b.scores.overall - a.scores.overall)
  const top = ranked[0]
  const average = Math.round(
    ranked.reduce((sum, analysis) => sum + analysis.scores.overall, 0) / ranked.length,
  )
  const recommendedCount = ranked.filter((analysis) => analysis.recommended).length

  const stats = [
    {
      label: 'Candidatos analizados',
      value: String(ranked.length),
      sub: `${recommendedCount} recomendados`,
      icon: Users,
      tone: 'bg-indigo-50 text-indigo-600',
      highlight: false,
    },
    {
      label: 'Candidato top',
      value: `${top.scores.overall}%`,
      sub: top.contactInfo.name,
      icon: Trophy,
      tone: 'bg-amber-50 text-amber-600',
      highlight: true,
    },
    {
      label: 'Puntuación media',
      value: `${average}%`,
      sub: 'de compatibilidad',
      icon: Target,
      tone: 'bg-emerald-50 text-emerald-600',
      highlight: false,
    },
  ]

  return (
    <section aria-label="Ranking de candidatos" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
          Ranking de candidatos
        </h2>
        <p className="text-xs text-slate-400">Ordenado por puntuación de mayor a menor</p>
      </div>

      {/* General metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm ${
              stat.highlight ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200'
            }`}
          >
            <span
              aria-hidden="true"
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${stat.tone}`}
            >
              <stat.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xl font-bold tabular-nums leading-none text-slate-900">
                {stat.value}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">{stat.label}</p>
              <p className="truncate text-xs text-slate-400" title={stat.sub}>
                {stat.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Ranked cards */}
      <div className="space-y-4">
        {ranked.map((analysis, index) => (
          <CandidateCard key={analysis.cvId} analysis={analysis} rank={index + 1} />
        ))}
      </div>
    </section>
  )
}

export default CandidateRanking
