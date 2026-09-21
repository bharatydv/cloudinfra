import { Clock } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { Container, Section } from '@/components/ui/primitives'
import { EmptyState } from '@/components/ui/states'
import { useSeo } from '@/hooks/useSeo'

/**
 * The course catalogue is not open yet. The page keeps its URL, title and
 * breadcrumbs so links and search listings stay valid, and sends visitors to
 * what is live today: certifications and exam booking.
 */
export default function CoursesPage() {
  useSeo({
    title: 'Online technology courses',
    description:
      'Structured, self-paced courses across cloud computing, AI, machine learning, data science, DevOps and digital marketing are on their way.',
  })

  return (
    <>
      <PageHeader
        title="Online technology courses"
        description="Structured, self-paced courses that build the fundamentals first and finish with something you have actually built."
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Courses', url: '/courses' },
        ]}
      />

      <Section className="py-16">
        <Container>
          <EmptyState
            icon={<Clock className="h-6 w-6" aria-hidden="true" />}
            title="Coming soon"
            description="We are putting the finishing touches on the first courses. In the meantime, explore certifications or book an exam at a discount."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <ButtonLink to="/certifications">Browse certifications</ButtonLink>
                <ButtonLink to="/schedule-exam" variant="outline">
                  Schedule an exam
                </ButtonLink>
              </div>
            }
          />
        </Container>
      </Section>
    </>
  )
}
