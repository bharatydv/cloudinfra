import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'

import { ArticleCard } from '@/components/cards/ArticleCard'
import { TestimonialCard } from '@/components/cards/misc'
import { Hero } from '@/components/marketing/Hero'
import {
  CertificationPathsSection,
  ProviderSpotlightSection,
  TopDealsSection,
} from '@/components/marketing/discovery'
import {
  CTASection,
  HowItWorksSection,
  LearningPathSection,
  TrustSection,
  WhyChooseUsSection,
} from '@/components/marketing/sections'
import { Accordion } from '@/components/ui/Accordion'
import { ButtonLink } from '@/components/ui/Button'
import { Container, Section, SectionHeading } from '@/components/ui/primitives'
import { CardSkeleton, ErrorState, Skeleton } from '@/components/ui/states'
import { getHome } from '@/api/endpoints'
import { siteConfig } from '@/config/brand'
import { useServerSeo } from '@/hooks/useSeo'
import { useSite } from '@/hooks/useSite'
import { queryKeys } from '@/lib/queryClient'

export default function HomePage() {
  const { learningPath } = useSite()
  // One aggregate request keeps the landing page to a single round trip.
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.home,
    queryFn: getHome,
  })

  useServerSeo(data?.seo, 'Cloud Certifications & Courses at Discounted Prices')

  // The hero quotes the deepest discount actually on offer, so the headline is
  // a fact about the catalogue rather than a marketing claim.
  const topDiscount = data?.top_deals?.[0]?.discount_percentage ?? null

  const realTestimonials = (data?.testimonials ?? []).filter(
    (testimonial) => !testimonial.is_demo,
  )

  return (
    <>
      <Hero topDiscount={topDiscount} />

      {/* The closing CTA is rendered only once the content above it has
          resolved. Rendering it during the load would put it directly under
          the hero and then push it down the page when the sections arrive,
          which is a large layout shift on every first visit. */}
      {isPending ? (
        <HomeSkeleton />
      ) : isError ? (
        <>
          <Section>
            <Container>
              <ErrorState
                title="We could not load the homepage"
                description="The content service did not respond. Please try again."
                onRetry={() => void refetch()}
              />
            </Container>
          </Section>
          <HomeCta />
        </>
      ) : (
        <>
          {/* Deals lead: price is what a visitor came to compare. */}
          <TopDealsSection deals={data?.top_deals ?? []} />

          <ProviderSpotlightSection providers={data?.providers ?? []} />

          <CertificationPathsSection providers={data?.providers ?? []} />

          <TrustSection categories={data?.categories ?? []} />

          <LearningPathSection steps={learningPath} />
          <WhyChooseUsSection />
          <HowItWorksSection />

          {/* Latest resources */}
          {(data?.latest_articles.length ?? 0) > 0 && (
            <Section>
              <Container>
                <SectionHeading
                  eyebrow="Resources"
                  title="Guides, roadmaps and exam preparation"
                  description="In-depth articles written against current vendor documentation."
                  action={
                    <ButtonLink
                      to="/resources"
                      variant="outline"
                      trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                    >
                      All resources
                    </ButtonLink>
                  }
                />
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {data?.latest_articles.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              </Container>
            </Section>
          )}

          {/* Testimonials.

              Seeded demo rows never reach the homepage: a quote labelled as
              placeholder in the social-proof slot is worse than an empty
              section, so the section only exists once real ones do. */}
          {realTestimonials.length > 0 && (
            <Section tone="muted">
              <Container>
                <SectionHeading eyebrow="Testimonials" title="What learners say" align="center" />
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {realTestimonials.slice(0, 3).map((testimonial) => (
                    <TestimonialCard key={testimonial.id} testimonial={testimonial} />
                  ))}
                </div>
              </Container>
            </Section>
          )}

          {/* FAQ */}
          {(data?.faqs.length ?? 0) > 0 && (
            <Section>
              <Container className="max-w-3xl">
                <SectionHeading
                  eyebrow="FAQ"
                  title="Frequently asked questions"
                  align="center"
                />
                <Accordion
                  items={(data?.faqs ?? []).map((faq) => ({
                    question: faq.question,
                    answer: faq.answer,
                  }))}
                />
              </Container>
            </Section>
          )}

          {/* Stated plainly rather than buried in the footer: visitors compare
              prices here, so they should know what we are and are not. */}
          <Section className="py-10">
            <Container className="max-w-3xl">
              <p className="rounded-lg border border-ink-200 bg-ink-50 p-4 text-center text-xs leading-relaxed text-ink-500">
                {siteConfig.independenceNotice} {siteConfig.trademarkNotice}
              </p>
            </Container>
          </Section>

          <HomeCta />
        </>
      )}
    </>
  )
}

function HomeCta() {
  return (
    <CTASection
      title="Ready to sit your certification exam?"
      description="Tell us which exam you want and when suits you. Our team confirms your slot by email."
      primary={{ label: 'Schedule an Exam', to: '/schedule-exam' }}
      secondary={{ label: 'Explore Deals', to: '/deals' }}
    />
  )
}

/**
 * Stand-in for the first two data-driven sections (top deals, provider
 * spotlight) at roughly their real height, so the viewport below the hero is
 * occupied from the first paint and the content swaps in place rather than
 * pushing everything down.
 */
function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the latest deals and certifications</span>
      <Section tone="muted">
        <Container>
          <div className="mb-10">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-80 max-w-full" />
            <Skeleton className="mt-3 h-4 w-96 max-w-full" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </Container>
      </Section>
      <Section>
        <Container>
          <div className="mb-10">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-72 max-w-full" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </Container>
      </Section>
    </div>
  )
}
