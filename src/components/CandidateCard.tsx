import type { LucideIcon } from 'lucide-react'
import {
  CircleCheck,
  Globe,
  HeartHandshake,
  ListChecks,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useCountUp } from '../hooks/useCountUp'
import type { CVAnalysis } from '../types'

export interface CandidateCardProps {
  analysis: CVAnalysis
  /** 1-based position within the ranking. */
  rank: number
}

interface Tier {
  label: string
  ring: string
  bar: string
  chip: string
}

/**
 * Badge colours: green > 80%, yellow 60-79%, red < 60%
 * (80 falls into green so no score is left uncovered).
 */
export function getCompatibilityTier(score: number): Tier {
  if (score >= 80) {
    return {
      label: 'Alta compatibilidad',
      ring: 'text-emerald-500',
      bar: 'bg-emerald-500',
      chip:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    }
  }
  if (score >= 60) {
    return {
      label: 'Compatibilidad media',
      ring: 'text-amber-500',
      bar: 'bg-amber-500',
      chip:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    }
  }
  return {
    label: 'Baja compatibilidad',
    ring: 'text-rose-500',
    bar: 'bg-rose-500',
    chip:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  }
}

const RING_RADIUS = 26
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
      <Icon aria-hidden="true" className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
      {children}
    </h3>
  )
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon
  label: string
  value: string
  href?: string
}) {
  const content = (
    <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
      <Icon
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400"
      />
      <span className="truncate" title={value}>
        {value}
      </span>
    </span>
  )

  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
        {label}
      </dt>
      <dd className="mt-0.5 truncate">
        {href ? (
          <a
            href={href}
            target={href.startsWith('http') ? '_blank' : undefined}
            rel={href.startsWith('http') ? 'noreferrer' : undefined}
            className="truncate rounded focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 hover:text-indigo-700 dark:hover:text-indigo-300"
          >
            {content}
          </a>
        ) : (
          content
        )}
      </dd>
    </div>
  )
}

function linkedinHref(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export function CandidateCard({ analysis, rank }: CandidateCardProps) {
  const { contactInfo, scores, culturalFit, interviewQuestions } = analysis
  const tier = getCompatibilityTier(scores.overall)
  const clamped = Math.min(100, Math.max(0, scores.overall))

  // Ring, number and bars all start after this card's entrance (driven by `rank`).
  const scoreDisplay = useCountUp(clamped, {
    duration: 1100,
    delay: (rank - 1) * 90 + 150,
  })

  const breakdown = [
    { label: 'Habilidades técnicas', value: scores.skillsMatch },
    { label: 'Experiencia', value: scores.experienceMatch },
    { label: 'Formación', value: scores.educationMatch },
    { label: 'Keywords', value: scores.keywordsMatch },
  ]

  return (
    <article
      style={{ ['--i']: rank - 1 } as CSSProperties}
      className="anim-rise overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      {/* Contact + score */}
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white dark:bg-indigo-500">
              Nº {rank}
            </span>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
              Candidato
            </p>
            {analysis.recommended && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CircleCheck aria-hidden="true" className="h-3.5 w-3.5" />
                Recomendado
              </span>
            )}
          </div>

          <p
            className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-slate-50"
            title={contactInfo.name}
          >
            {contactInfo.name}
          </p>

          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <ContactRow
              icon={Mail}
              label="Correo"
              value={contactInfo.email}
              href={`mailto:${contactInfo.email}`}
            />
            {contactInfo.phone && (
              <ContactRow
                icon={Phone}
                label="Teléfono"
                value={contactInfo.phone}
                href={`tel:${contactInfo.phone.replace(/\s/g, '')}`}
              />
            )}
            {contactInfo.linkedin && (
              <ContactRow
                icon={Globe}
                label="LinkedIn"
                value={contactInfo.linkedin}
                href={linkedinHref(contactInfo.linkedin)}
              />
            )}
            {contactInfo.location && (
              <ContactRow icon={MapPin} label="Ubicación" value={contactInfo.location} />
            )}
          </dl>
        </div>

        {/* Compatibility ring: draws itself on mount, number counts up with it */}
        <div className="flex flex-col items-center gap-2 lg:w-44">
          <div className="relative h-24 w-24">
            <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle
                cx="32"
                cy="32"
                r={RING_RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-slate-100 dark:text-slate-800"
              />
              <circle
                cx="32"
                cy="32"
                r={RING_RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                className={`${tier.ring} anim-ring`}
                strokeDasharray={RING_CIRCUMFERENCE}
                style={
                  {
                    '--ring-full': String(RING_CIRCUMFERENCE),
                    '--ring-offset': String(RING_CIRCUMFERENCE * (1 - clamped / 100)),
                  } as CSSProperties
                }
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {Math.round(scoreDisplay)}%
            </span>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tier.chip}`}>
            {tier.label}
          </span>
        </div>
      </div>

      <div className="space-y-5 border-t border-slate-100 p-4 sm:p-6 dark:border-slate-800">
        {/* Executive summary */}
        <section className="space-y-2">
          <SectionTitle icon={Sparkles}>Resumen ejecutivo</SectionTitle>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {analysis.summary}
          </p>
        </section>

        {/* Score breakdown (bars grow once the card has landed) */}
        <section className="space-y-2">
          <SectionTitle icon={ListChecks}>Detalle de puntuaciones</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {breakdown.map((item, index) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {item.label}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {item.value}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${tier.bar} anim-bar`}
                    style={
                      {
                        '--w': `${item.value}%`,
                        '--j': index,
                        width: `${item.value}%`,
                      } as CSSProperties
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Strengths & weaknesses */}
        <section className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <SectionTitle icon={ThumbsUp}>Puntos fuertes</SectionTitle>
            <ul className="flex flex-wrap gap-2">
              {analysis.strengths.map((strength) => (
                <li
                  key={strength}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                >
                  {strength}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <SectionTitle icon={ThumbsDown}>Carencias y requisitos faltantes</SectionTitle>
            <ul className="flex flex-wrap gap-2">
              {analysis.weaknesses.map((weakness) => (
                <li
                  key={weakness}
                  className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  {weakness}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Cultural fit */}
        {culturalFit && (
          <section className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-500/20 dark:bg-violet-500/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle icon={HeartHandshake}>Fit cultural y soft skills</SectionTitle>
              <span className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-violet-700 dark:border-violet-500/30 dark:bg-slate-900 dark:text-violet-300">
                {culturalFit.score}%
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {culturalFit.assessment}
            </p>
            {culturalFit.softSkills.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {culturalFit.softSkills.map((skill) => (
                  <li
                    key={skill}
                    className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs font-medium text-violet-700 dark:border-violet-500/30 dark:bg-slate-900 dark:text-violet-300"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Interview questions */}
        {interviewQuestions?.length > 0 && (
          <section className="space-y-2">
            <SectionTitle icon={MessageSquare}>
              Preguntas recomendadas para la entrevista
            </SectionTitle>
            <ol className="space-y-2">
              {interviewQuestions.map((question, index) => (
                <li key={question} className="flex gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {question}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </article>
  )
}

export default CandidateCard
