import { useLocation } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Card, Container, Section } from '@/components/ui/primitives'
import { siteConfig } from '@/config/brand'
import { useSeo } from '@/hooks/useSeo'
import { useSite } from '@/hooks/useSite'
import { formatDate } from '@/lib/format'

type LegalKey = 'privacy' | 'terms' | 'refund' | 'disclaimer' | 'cookies'

const PAGES: Record<string, { key: LegalKey; title: string; description: string }> = {
  '/privacy': {
    key: 'privacy',
    title: 'Privacy policy',
    description: 'How we collect, use and protect your data.',
  },
  '/terms': {
    key: 'terms',
    title: 'Terms of service',
    description: 'The terms that govern use of this platform.',
  },
  '/refund-policy': {
    key: 'refund',
    title: 'Refund policy',
    description: 'When and how refunds are issued.',
  },
  '/disclaimer': {
    key: 'disclaimer',
    title: 'Disclaimer',
    description: 'Important information about our independence from certification vendors.',
  },
  '/cookie-policy': {
    key: 'cookies',
    title: 'Cookie policy',
    description: 'How we use cookies and similar technologies.',
  },
}

/**
 * Legal pages render copy stored in site settings, so wording can be updated by
 * an operator without a deploy.
 */
export default function LegalPage() {
  const { pathname } = useLocation()
  const { legal, brand, contact } = useSite()

  const page = PAGES[pathname] ?? PAGES['/disclaimer']!
  const body = legal[page.key] ?? ''
  const lastUpdated = legal.lastUpdated
  /**
   * The configured contact address first: `brand.supportEmail` falls back to a
   * placeholder when nobody has set it, and a placeholder address on a privacy
   * policy is worse than none.
   */
  const supportEmail = contact.email ?? brand.supportEmail

  useSeo({ title: page.title, description: page.description })

  return (
    <>
      <PageHeader
        title={page.title}
        description={page.description}
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: page.title, url: pathname },
        ]}
      />

      <Section className="py-14">
        <Container className="max-w-3xl">
          <Card className="p-6 sm:p-8">
            {lastUpdated && (
              <p className="mb-6 text-xs font-medium uppercase tracking-wider text-ink-500">
                Last updated {formatDate(lastUpdated)}
              </p>
            )}

            {body ? (
              <div className="space-y-4 text-[1.0625rem] leading-relaxed text-ink-700">
                {body.split('\n\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-600">
                This policy is being updated. Email {supportEmail} in the meantime and we will
                send you the current version.
              </p>
            )}

            {page.key !== 'disclaimer' && (
              <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs leading-relaxed text-amber-900">
                  {siteConfig.independenceNotice}
                </p>
              </div>
            )}

            <p className="mt-8 border-t border-ink-200 pt-6 text-sm text-ink-600">
              Questions about this policy? Email{' '}
              <a
                href={`mailto:${supportEmail}`}
                className="font-medium text-brand-700 underline underline-offset-2"
              >
                {supportEmail}
              </a>
              .
            </p>
          </Card>
        </Container>
      </Section>
    </>
  )
}
