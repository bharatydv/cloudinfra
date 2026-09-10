import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  BookMarked,
  Briefcase,
  Compass,
  GraduationCap,
  Hammer,
  Layers,
  Target,
  TrendingUp,
} from 'lucide-react'

import { CategoryIcon } from '@/components/cards/CategoryIcon'
import { ButtonLink } from '@/components/ui/Button'
import { Card, Container, Section, SectionHeading } from '@/components/ui/primitives'
import { AnalyticsEvent, track } from '@/lib/analytics'
import { cn } from '@/lib/cn'
import type { CourseCategory } from '@/types/api'

/* -------------------------------------------------------------------------- */
/* Trust / categories                                                         */
/* -------------------------------------------------------------------------- */
export function TrustSection({ categories }: { categories: CourseCategory[] }) {
  if (categories.length === 0) return null

  return (
    <Section tone="muted" className="py-14 sm:py-16">
      <Container>
        <SectionHeading
          title="Build skills that matter."
          description="Focused tracks across the technology disciplines employers are actually hiring for."
          align="center"
        />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {categories.slice(0, 6).map((category) => (
            <li key={category.id}>
              <Link
                to={`/courses?category=${category.slug}`}
                className="group flex h-full flex-col items-center gap-3 rounded-xl border border-ink-200 bg-white p-5 text-center transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
                  <CategoryIcon name={category.icon ?? category.slug} className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold leading-snug text-ink-800">
                  {category.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Learning path                                                              */
/* -------------------------------------------------------------------------- */
const PATH_ICONS = [Compass, Layers, Target, Hammer, BookMarked, GraduationCap, TrendingUp]

export function LearningPathSection({
  steps,
}: {
  steps: Array<{ title: string; description: string }>
}) {
  if (steps.length === 0) return null

  return (
    <Section tone="dark">
      <Container>
        <SectionHeading
          eyebrow="Learning path"
          title="A path you can actually follow."
          description="Every stage builds on the previous one, so you always know what to do next."
          align="center"
          tone="dark"
        />

        <ol className="relative grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = PATH_ICONS[index % PATH_ICONS.length]!
            return (
              <li
                key={step.title}
                className="relative rounded-xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm transition hover:border-brand-400/40 hover:bg-white/[0.07]"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-bold tracking-widest text-ink-500">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">{step.description}</p>
              </li>
            )
          })}
        </ol>
      </Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Why choose us                                                              */
/* -------------------------------------------------------------------------- */
const REASONS = [
  {
    icon: Layers,
    title: 'Structured learning',
    description:
      'Ordered modules and lessons that build on each other, so you are never guessing what to study next.',
  },
  {
    icon: Hammer,
    title: 'Practical projects',
    description:
      'Every course ends with something you have to build, because concepts you have used are the ones that stay.',
  },
  {
    icon: GraduationCap,
    title: 'Certification preparation',
    description:
      'Preparation material mapped to the objectives each vendor publishes, with links to the official source.',
  },
  {
    icon: Briefcase,
    title: 'Industry-relevant skills',
    description:
      'Content is revised as the underlying platforms change, rather than left to age quietly.',
  },
  {
    icon: BarChart3,
    title: 'Progress tracking',
    description:
      'Lesson-level progress saved to your account, so you can resume on any device where you left off.',
  },
  {
    icon: TrendingUp,
    title: 'Career-focused learning',
    description:
      'Paths organised around the roles you are aiming at, not around a catalogue of disconnected topics.',
  },
]

export function WhyChooseUsSection() {
  return (
    <Section>
      <Container>
        <SectionHeading
          eyebrow="Why choose us"
          title="Built for people who need to actually learn this."
          description="A serious platform for serious preparation, with no shortcuts we cannot stand behind."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {REASONS.map((reason) => (
            <Card key={reason.title} className="p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <reason.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold text-ink-900">{reason.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{reason.description}</p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* How it works                                                               */
/* -------------------------------------------------------------------------- */
const STEPS = [
  { number: '01', title: 'Discover', description: 'Explore courses and certification paths.' },
  { number: '02', title: 'Learn', description: 'Follow structured lessons and practical resources.' },
  {
    number: '03',
    title: 'Practice',
    description: 'Test your knowledge through quizzes and practice resources.',
  },
  {
    number: '04',
    title: 'Advance',
    description: 'Use your knowledge to progress toward certification and career goals.',
  },
]

export function HowItWorksSection() {
  return (
    <Section tone="muted">
      <Container>
        <SectionHeading
          eyebrow="How it works"
          title="Four steps from curious to certified."
          align="center"
        />
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.number} className="relative">
              <Card className="h-full p-6">
                <span className="text-3xl font-extrabold tracking-tight text-brand-200">
                  {step.number}
                </span>
                <h3 className="mt-3 text-base font-bold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.description}</p>
              </Card>
              {index < STEPS.length - 1 && (
                <ArrowRight
                  className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-ink-300 lg:block"
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Final CTA                                                                  */
/* -------------------------------------------------------------------------- */
export function CTASection({
  title = 'Ready to build your next skill?',
  description = 'Start learning today and take the next step toward your professional goals.',
  primary = { label: 'Explore Courses', to: '/courses' },
  secondary = { label: 'Explore Certifications', to: '/certifications' },
  className,
}: {
  title?: string
  description?: string
  primary?: { label: string; to: string }
  secondary?: { label: string; to: string }
  className?: string
}) {
  return (
    <Section className={cn('py-16 sm:py-20', className)}>
      <Container>
        <div className="relative overflow-hidden rounded-2xl bg-ink-950 px-6 py-14 text-center sm:px-14">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,rgb(79_70_229/0.35),transparent)]"
          />
          <div className="relative">
            <h2 className="text-heading-lg text-white sm:text-4xl">{title}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-300">
              {description}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink
                to={primary.to}
                size="lg"
                onClick={() =>
                  track(AnalyticsEvent.CtaClicked, { properties: { cta: 'final_primary' } })
                }
              >
                {primary.label}
              </ButtonLink>
              <ButtonLink
                to={secondary.to}
                size="lg"
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:bg-white/10"
              >
                {secondary.label}
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}
