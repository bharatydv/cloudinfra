import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'

import { ArticleCard } from '@/components/cards/ArticleCard'
import { CertificationCard } from '@/components/cards/CertificationCard'
import { CourseCard } from '@/components/cards/CourseCard'
import { ProviderCard, TestimonialCard } from '@/components/cards/misc'
import { Hero } from '@/components/marketing/Hero'
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
import { CardGridSkeleton, ErrorState } from '@/components/ui/states'
import { getHome } from '@/api/endpoints'
import { useServerSeo } from '@/hooks/useSeo'
import { useSite } from '@/hooks/useSite'
import { queryKeys } from '@/lib/queryClient'

export default function HomePage() {
  const { learningPath } = useSite()
  // One aggregate request keeps the landing page to a single round trip.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.home,
    queryFn: getHome,
  })

  useServerSeo(data?.seo, 'Learn. Get Certified. Build Your Future.')

  return (
    <>
      <Hero />

      {isError ? (
        <Section>
          <Container>
            <ErrorState
              title="We could not load the homepage"
              description="The content service did not respond. Please try again."
              onRetry={() => void refetch()}
            />
          </Container>
        </Section>
      ) : (
        <>
          <TrustSection categories={data?.categories ?? []} />

          {/* Featured certifications */}
          <Section>
            <Container>
              <SectionHeading
                eyebrow="Certifications"
                title="Popular Certifications"
                description="Explore certification preparation paths across leading technology ecosystems."
                action={
                  <ButtonLink
                    to="/certifications"
                    variant="outline"
                    trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  >
                    View all
                  </ButtonLink>
                }
              />
              {isLoading ? (
                <CardGridSkeleton />
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {data?.featured_certifications.map((certification) => (
                    <CertificationCard key={certification.id} certification={certification} />
                  ))}
                </div>
              )}

              {(data?.providers.length ?? 0) > 0 && (
                <div className="mt-10">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-500">
                    Preparation resources by provider
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {data?.providers.map((provider) => (
                      <ProviderCard key={provider.id} provider={provider} />
                    ))}
                  </div>
                </div>
              )}
            </Container>
          </Section>

          {/* Popular courses */}
          <Section tone="muted">
            <Container>
              <SectionHeading
                eyebrow="Courses"
                title="Explore Popular Courses"
                description="Self-paced, structured courses across cloud, AI, data, DevOps and marketing."
                action={
                  <ButtonLink
                    to="/courses"
                    variant="outline"
                    trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  >
                    Browse all courses
                  </ButtonLink>
                }
              />
              {isLoading ? (
                <CardGridSkeleton />
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {data?.featured_courses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </div>
              )}
            </Container>
          </Section>

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

          {/* Testimonials */}
          {(data?.testimonials.length ?? 0) > 0 && (
            <Section tone="muted">
              <Container>
                <SectionHeading
                  eyebrow="Testimonials"
                  title="What learners say"
                  description="Quotes are labelled when they are placeholder content."
                  align="center"
                />
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {data?.testimonials.slice(0, 3).map((testimonial) => (
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
        </>
      )}

      <CTASection />
    </>
  )
}
