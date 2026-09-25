import { Briefcase, FileText, WandSparkles } from 'lucide-react'

export interface SampleOffer {
  id: string
  label: string
  text: string
}

/** Ready-to-use offers so demos can be filled in one click. */
export const SAMPLE_OFFERS: SampleOffer[] = [
  {
    id: 'fullstack',
    label: 'Desarrollador Full Stack React + .NET',
    text: `Desarrollador/a Full Stack React + .NET

Ubicación: Madrid (hibrido, 2 días en oficina) | Jornada completa | Contrato indefinido

Sobre el puesto:
Buscamos una persona desarrolladora para unirse al equipo de producto de una plataforma SaaS B2B en crecimiento. Trabajarás en una squad crossfuncional (producto, diseño, QA) construyendo funcionalidades de extremo a extremo.

Responsabilidades:
- Desarrollar y mantener funcionalidades front-end con React 18, TypeScript y Tailwind CSS.
- Construir y consumir APIs REST y GraphQL en .NET 8 (C#) con Entity Framework.
- Escribir pruebas unitarias y de integración (Vitest, xUnit) y participar en code reviews.
- Colaborar en la arquitectura de microservicios y en la CI/CD con Azure DevOps o GitHub Actions.
- Monitorizar y optimizar el rendimiento en producción.

Requisitos imprescindibles:
- 3+ años de experiencia con React y TypeScript en producción.
- 3+ años con C# y el ecosistema .NET.
- Dominio de SQL (SQL Server o PostgreSQL) y diseño de modelos de datos.
- Conocimientos de Docker y despliegues en la nube (Azure o AWS).
- Inglés B2: lectura y escritura.

Se valorará:
- Experiencia con Next.js, GraphQL y arquitecturas microservicio.
- Conocimientos de Kubernetes e infraestructura como código (Terraform).
- Experiencia en entornos ágiles con Scrum.

Oferta:
- Salario: 45.000 – 55.000 € brutos anuales según experiencia.
- 23 días laborables + flexibilidad horaria.
- Presupuesto individual de formación y plan de retribución flexible.`,
  },
  {
    id: 'ux-ui',
    label: 'Diseñador UX/UI',
    text: `Diseñador/a UX/UI

Ubicación: Remoto (España) | Jornada completa | Contrato indefinido

Sobre el puesto:
Buscamos una persona diseñadora de producto para nuestra app móvil y web de finanzas personales. Definirás la experiencia de usuario de nuevas funciones de principio a fin, junto a producto e ingeniería.

Responsabilidades:
- Investigación de usuarios: entrevistas, análisis de métricas y tests de usabilidad.
- Wireframes, flujos, prototipos de alta fidelidad y microinteracciones en Figma.
- Mantener y evolucionar el design system (tokens, componentes y documentación en Figma + Storybook).
- Colaborar estrechamente con desarrollo en la implementación y revisión de features en producción.
- Presentar y defender decisiones de diseño ante stakeholders.

Requisitos imprescindibles:
- 3+ años diseñando productos digitales (web y móvil) con portfolio acreditado.
- Dominio avanzado de Figma (auto layout, variables, componentes).
- Conocimientos sólidos de HTML, CSS y de las capacidades y limitaciones del desarrollo front-end.
- Metodologías de diseño centrado en el usuario y diseño accesible (WCAG 2.2).

Se valorará:
- Experiencia con motion design (After Effects, Rive) y prototipado interactivo.
- Conocimientos de analytics de producto (Amplitude, Mixpanel) y A/B testing.
- Inglés C1.

Oferta:
- Salario: 38.000 – 46.000 € brutos anuales.
- Totalmente remoto con reuniones trimestrales presenciales.
- Equipo de diseño de 6 personas y presupuesto para conferencias y formación.`,
  },
]

export interface JobOfferInputProps {
  value: string
  onChange: (value: string) => void
  /** Defaults to SAMPLE_OFFERS. */
  samples?: SampleOffer[]
  className?: string
}

export function JobOfferInput({
  value,
  onChange,
  samples = SAMPLE_OFFERS,
  className = '',
}: JobOfferInputProps) {
  const activeId = samples.find((sample) => sample.text === value)?.id

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"
        >
          <Briefcase className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
            Oferta de trabajo
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 sm:text-sm">
            Pega la descripción completa del puesto. Se usará como referencia para puntuar
            cada currículum.
          </p>
        </div>
      </div>

      <label htmlFor="job-offer" className="sr-only">
        Texto de la oferta de trabajo
      </label>
      <textarea
        id="job-offer"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ej.: Desarrollador/a Full Stack React + .NET — Buscamos una persona con experiencia en…"
        className="mt-4 min-h-44 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 sm:min-h-48 sm:text-base"
        spellCheck={false}
      />

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <WandSparkles aria-hidden="true" className="h-3.5 w-3.5" />
            Cargar oferta de ejemplo:
          </span>

          {samples.map((sample) => {
            const isActive = activeId === sample.id
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => onChange(sample.text)}
                aria-pressed={isActive}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 ${
                  isActive
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                <FileText aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{sample.label}</span>
              </button>
            )
          })}
        </div>

        <span className="shrink-0 text-xs tabular-nums text-slate-400">
          {value.length} caracteres
        </span>
      </div>
    </section>
  )
}

export default JobOfferInput
