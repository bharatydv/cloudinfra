/**
 * Homepage sections that help someone find the right certification and see
 * what it costs.
 *
 * These sit alongside the existing marketing sections rather than replacing
 * them: everything here is driven by catalogue data, so a section disappears
 * when there is nothing real to put in it instead of falling back to filler.
 */

import { Link } from 'react-router-dom'
import { ArrowRight, Compass, GraduationCap } from 'lucide-react'

import { DealCard } from '@/components/cards/DealCard'
import { ButtonLink } from '@/components/ui/Button'
import { Card, Container, Section, SectionHeading } from '@/components/ui/primitives'
import { pluralize } from '@/lib/format'
import type { DealCard as DealCardType, ProviderCard as ProviderCardType } from '@/types/api'

/* -------------------------------------------------------------------------- */
/* Provider spotlight                                                         */
/* -------------------------------------------------------------------------- */
/**
 * The ecosystems people arrive already committed to.
 *
 * Built from the providers the API returns rather than a hardcoded list of
 * vendor names, so it can never advertise a provider with nothing behind it --
 * and naming a provider here describes what the material covers, not a
 * partnership with them.
 */
export function ProviderSpotlightSection({ providers }: { providers: ProviderCardType[] }) {
  if (providers.length === 0) return null

  return (
    <Section className="py-14">
      <Container>
        <SectionHeading
          eyebrow="Providers"
          title="Browse certifications by provider"
          description="Each provider page lists every certification we publish preparation material and pricing for."
          action={
            <ButtonLink
              to="/certifications"
              variant="outline"
              trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
            >
              All certifications
            </ButtonLink>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <Link
              key={provider.id}
              to={`/certifications/${provider.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-ink-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
            >
              {provider.logo ? (
                <img
                  src={provider.logo}
                  alt=""
                  loading="lazy"
                  className="h-11 w-11 shrink-0 rounded-lg object-contain"
                />
              ) : (
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <GraduationCap className="h-5 w-5" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink-900 group-hover:text-brand-700">
                  {provider.name} certifications
                </p>
                <p className="text-xs text-ink-500">
                  {provider.certification_count > 0
                    ? pluralize(provider.certification_count, 'certification')
                    : 'Preparation resources'}
                </p>
              </div>
              <ArrowRight
                className="ml-auto h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Certification paths                                                        */
/* -------------------------------------------------------------------------- */
/**
 * The order vendors intend their own certifications to be taken in.
 *
 * Each step links into the existing filtered catalogue rather than naming
 * individual exams, so a path can never point at a certification we do not
 * publish, and nothing needs maintaining by hand as the catalogue changes.
 */
const PATH_STAGES = [
  { level: 'foundational', label: 'Foundational', blurb: 'Start here with no prior experience' },
  { level: 'associate', label: 'Associate', blurb: 'The first professional credential' },
  { level: 'professional', label: 'Professional', blurb: 'Depth for experienced engineers' },
] as const

export function CertificationPathsSection({ providers }: { providers: ProviderCardType[] }) {
  if (providers.length === 0) return null

  return (
    <Section tone="muted" className="py-14">
      <Container>
        <SectionHeading
          eyebrow="Learning paths"
          title="Not sure which certification to take?"
          description="Most vendors stack their certifications the same way. Pick the ecosystem you work in, then start at the level that matches your experience."
        />

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {providers.slice(0, 6).map((provider) => (
            <Card key={provider.id} className="flex h-full flex-col p-6">
              <div className="flex items-center gap-3">
                {provider.logo ? (
                  <img
                    src={provider.logo}
                    alt=""
                    loading="lazy"
                    className="h-9 w-9 rounded-lg object-contain"
                  />
                ) : (
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Compass className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
                <h3 className="text-base font-bold text-ink-900">{provider.name} path</h3>
              </div>

              <ol className="mt-5 flex-1 space-y-2.5">
                {PATH_STAGES.map((stage, index) => (
                  <li key={stage.level}>
                    <Link
                      to={`/certifications?provider=${provider.slug}&level=${stage.level}`}
                      className="group flex items-start gap-3 rounded-lg border border-ink-200 bg-white p-3 transition hover:border-brand-200 hover:bg-brand-50/40"
                    >
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-600 group-hover:bg-brand-100 group-hover:text-brand-700">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink-900">
                          {stage.label}
                        </span>
                        <span className="block text-xs text-ink-500">{stage.blurb}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>

              <Link
                to={`/certifications/${provider.slug}`}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                See every {provider.name} certification
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Top deals                                                                  */
/* -------------------------------------------------------------------------- */
/**
 * The deepest current discounts.
 *
 * Renders nothing when nothing is discounted: an empty deals strip is worse
 * than no strip, and padding it out would mean inventing an offer.
 */
export function TopDealsSection({ deals }: { deals: DealCardType[] }) {
  if (deals.length === 0) return null

  return (
    <Section className="py-14">
      <Container>
        <SectionHeading
          eyebrow="Deals"
          title="The biggest savings right now"
          description="Certification exams and courses currently listed below their usual price, each with the date the price was last verified."
          action={
            <ButtonLink
              to="/deals"
              variant="outline"
              trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
            >
              All deals
            </ButtonLink>
          }
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {deals.slice(0, 6).map((deal) => (
            <DealCard key={`${deal.kind}-${deal.id}`} deal={deal} />
          ))}
        </div>
      </Container>
    </Section>
  )
}
