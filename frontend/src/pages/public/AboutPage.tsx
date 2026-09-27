import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, Compass, Eye, Info, Target } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { CTASection, WhyChooseUsSection } from '@/components/marketing/sections'
import { Accordion } from '@/components/ui/Accordion'
import { Avatar, Card, Container, Section, SectionHeading } from '@/components/ui/primitives'
import { getFaqs } from '@/api/endpoints'
import { siteConfig } from '@/config/brand'
import { useSeo } from '@/hooks/useSeo'
import { useSite } from '@/hooks/useSite'
import { queryKeys } from '@/lib/queryClient'

interface AboutValue {
  title: string
  description: string
}

interface TeamMember {
  name: string
  role?: string
  bio?: string
  image?: string
}

export default function AboutPage() {
  const { about, brand } = useSite()
  const { data: faqs } = useQuery({
    queryKey: queryKeys.faqs('about'),
    queryFn: () => getFaqs('about'),
  })

  useSeo({
    title: `About ${brand.brandName}`,
    description: `How ${brand.brandName} helps learners discover cloud certifications, courses and exam preparation resources, and how we price and verify what we list.`,
  })

  const values = (about.values as AboutValue[] | undefined) ?? []
  const team = (about.team as TeamMember[] | undefined) ?? []
  const achievements = (about.achievements as string[] | undefined) ?? []

  return (
    <>
      <PageHeader
        title={`About ${brand.brandName}`}
        description={brand.brandDescription}
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'About', url: '/about' },
        ]}
      />

      {/* What the platform actually does, stated plainly and without depending
          on admin-edited copy being present. Nothing here is a claim about the
          company -- those live in the editable settings below. */}
      <Section className="py-14">
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="What we do" title="Certifications, courses and what they cost" />
          <p className="text-[1.0625rem] leading-relaxed text-ink-700">
            {brand.brandName} helps learners and professionals discover certification courses,
            exam preparation resources and discounted certification opportunities. Every
            certification we list shows the provider&rsquo;s published exam fee alongside the
            price you pay here, the saving between them, and the date that price was last
            verified.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { to: '/certifications', label: 'Browse certifications' },
              { to: '/deals', label: 'See current deals' },
              { to: '/resources', label: 'Read guides and roadmaps' },
            ].map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="flex items-center justify-between gap-2 rounded-xl border border-ink-200 bg-white p-4 text-sm font-semibold text-ink-800 transition hover:border-brand-200 hover:text-brand-700"
                >
                  {link.label}
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {typeof about.story === 'string' && (
        <Section className="py-14">
          <Container className="max-w-3xl">
            <SectionHeading eyebrow="Our story" title="Why we built this" />
            <p className="text-[1.0625rem] leading-relaxed text-ink-700">{about.story}</p>
          </Container>
        </Section>
      )}

      <Section tone="muted" className="py-14">
        <Container>
          <div className="grid gap-6 md:grid-cols-3">
            {typeof about.mission === 'string' && (
              <Card className="p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Target className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-base font-bold text-ink-900">Mission</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{about.mission}</p>
              </Card>
            )}
            {typeof about.vision === 'string' && (
              <Card className="p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Eye className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-base font-bold text-ink-900">Vision</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{about.vision}</p>
              </Card>
            )}
            {typeof about.whyWeExist === 'string' && (
              <Card className="p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Compass className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-base font-bold text-ink-900">Why we exist</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{about.whyWeExist}</p>
              </Card>
            )}
          </div>
        </Container>
      </Section>

      {values.length > 0 && (
        <Section className="py-14">
          <Container>
            <SectionHeading eyebrow="What we value" title="How we make decisions" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {values.map((value) => (
                <Card key={value.title} className="p-6">
                  <h3 className="text-base font-bold text-ink-900">{value.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{value.description}</p>
                </Card>
              ))}
            </div>
          </Container>
        </Section>
      )}

      <WhyChooseUsSection />

      <Section tone="muted" className="py-14">
        <Container>
          <SectionHeading eyebrow="Our team" title="The people behind the content" />
          {team.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {team.map((member) => (
                <Card key={member.name} className="p-6 text-center">
                  <div className="flex justify-center">
                    <Avatar name={member.name} src={member.image} size="lg" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-ink-900">{member.name}</h3>
                  {member.role && <p className="text-xs text-ink-500">{member.role}</p>}
                  {member.bio && <p className="mt-3 text-sm text-ink-600">{member.bio}</p>}
                </Card>
              ))}
            </div>
          ) : (
            /* No invented biographies: the section states its own status. */
            <Card className="flex items-start gap-4 p-6">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                <Info className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-bold text-ink-900">Team profiles coming soon</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">
                  Team members are added through the admin settings once profiles are approved. We
                  do not publish placeholder people.
                </p>
              </div>
            </Card>
          )}
        </Container>
      </Section>

      <Section className="py-14">
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="Achievements" title="What we can verify" align="center" />
          {achievements.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {achievements.map((item) => (
                <li key={item}>
                  <Card className="p-5 text-sm text-ink-700">{item}</Card>
                </li>
              ))}
            </ul>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-sm leading-relaxed text-ink-600">
                {(about.achievementsNote as string) ??
                  'We publish metrics here only once they are real and verifiable.'}
              </p>
            </Card>
          )}

          <Card className="mt-8 border-amber-200 bg-amber-50 p-5">
            <p className="text-xs leading-relaxed text-amber-900">
              {siteConfig.independenceNotice} {siteConfig.trademarkNotice}
            </p>
          </Card>
        </Container>
      </Section>

      {(faqs?.length ?? 0) > 0 && (
        <Section tone="muted" className="py-14">
          <Container className="max-w-3xl">
            <SectionHeading title="Frequently asked questions" align="center" />
            <Accordion
              items={(faqs ?? []).map((faq) => ({ question: faq.question, answer: faq.answer }))}
            />
          </Container>
        </Section>
      )}

      <CTASection />
    </>
  )
}
