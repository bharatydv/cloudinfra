import { ArrowRight, BadgePercent, GraduationCap, Layers, Target } from 'lucide-react'
import { Link } from 'react-router-dom'

import { SearchBar } from '@/components/layout/SearchBar'
import { ButtonLink } from '@/components/ui/Button'
import { Container } from '@/components/ui/primitives'
import { AnalyticsEvent, track } from '@/lib/analytics'

/** Worked examples, so the search box explains itself without placeholder prose. */
const SEARCH_EXAMPLES = [
  'SAA-C03',
  'AZ-104',
  'AWS Solutions Architect',
  'Associate Cloud Engineer',
]

export function Hero({ topDiscount }: { topDiscount?: number | null }) {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Restrained background geometry: depth without visual noise. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,theme(colors.brand.50),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgb(226 232 240 / 0.7) 1px, transparent 1px), linear-gradient(to bottom, rgb(226 232 240 / 0.7) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(70% 60% at 50% 0%, black, transparent)',
            WebkitMaskImage: 'radial-gradient(70% 60% at 50% 0%, black, transparent)',
          }}
        />
      </div>

      <Container className="relative py-12 sm:py-16">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
              Certifications, courses and exam preparation
            </span>

            <h1 className="mt-6 text-display-lg text-ink-900 sm:text-[3.5rem]">
              Cloud Certifications &amp; Courses
              <br />
              {/* The headline figure is the deepest discount actually on offer,
                  so it changes with the catalogue instead of being a claim. */}
              <span className="text-brand-600">
                {topDiscount ? `at Up to ${topDiscount}% Off` : 'at Discounted Prices'}
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
              Discover AWS, Microsoft Azure, Google Cloud and other certification courses, exam
              preparation and learning resources at discounted prices.
            </p>

            <div className="mt-8 max-w-xl">
              <SearchBar
                size="lg"
                placeholder="Search certifications, exam codes or courses..."
              />
              <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                <span>Try:</span>
                {SEARCH_EXAMPLES.map((example) => (
                  <Link
                    key={example}
                    to={`/search?q=${encodeURIComponent(example)}`}
                    className="rounded-full border border-ink-200 px-2.5 py-1 font-medium text-ink-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {example}
                  </Link>
                ))}
              </p>
            </div>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink
                to="/deals"
                size="lg"
                leadingIcon={<BadgePercent className="h-4 w-4" aria-hidden="true" />}
                onClick={() =>
                  track(AnalyticsEvent.CtaClicked, { properties: { cta: 'hero_deals' } })
                }
              >
                Explore Deals
              </ButtonLink>
              <ButtonLink
                to="/certifications"
                size="lg"
                variant="outline"
                trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                onClick={() =>
                  track(AnalyticsEvent.CtaClicked, { properties: { cta: 'hero_certifications' } })
                }
              >
                Browse Certifications
              </ButtonLink>
              <ButtonLink
                to="/schedule-exam"
                size="lg"
                variant="ghost"
                onClick={() =>
                  track(AnalyticsEvent.CtaClicked, { properties: { cta: 'hero_schedule_exam' } })
                }
              >
                Schedule an Exam
              </ButtonLink>
            </div>
          </div>

          <HeroVisual />
        </div>
      </Container>
    </section>
  )
}

/**
 * An abstract representation of a learning path rather than stock photography:
 * it communicates the product and costs nothing to load.
 */
function HeroVisual() {
  return (
    <div className="relative hidden lg:block" aria-hidden="true">
      <div className="relative rounded-2xl border border-ink-200 bg-white p-6 shadow-lifted">
        <div className="flex items-center gap-2 border-b border-ink-200 pb-4">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          <span className="ml-3 text-xs font-medium text-ink-400">Your learning path</span>
        </div>

        <ol className="mt-5 space-y-3">
          {[
            { icon: Layers, label: 'Cloud Computing Fundamentals', meta: '9 lessons', progress: 100 },
            { icon: Target, label: 'Practice & knowledge checks', meta: '6 resources', progress: 64 },
            { icon: GraduationCap, label: 'Certification preparation', meta: '5 stages', progress: 25 },
          ].map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50/60 p-3.5"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-subtle">
                <item.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{item.label}</p>
                <p className="text-xs text-ink-500">{item.meta}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-200">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-semibold text-ink-500">{item.progress}%</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="absolute -bottom-6 -left-6 rounded-xl border border-ink-200 bg-white px-4 py-3 shadow-lifted">
        <p className="text-xs font-medium text-ink-500">Overall progress</p>
        <p className="text-2xl font-extrabold tracking-tight text-ink-900">63%</p>
      </div>
    </div>
  )
}
