import { Link } from 'react-router-dom'
import { Github, Linkedin, Mail, Youtube } from 'lucide-react'

import { Logo } from '@/components/layout/Logo'
import { Container } from '@/components/ui/primitives'
import { footerNavigation, siteConfig } from '@/config/brand'
import { useSite } from '@/hooks/useSite'

const SOCIAL_ICONS = {
  linkedin: Linkedin,
  github: Github,
  youtube: Youtube,
} as const

export function Footer() {
  const { brand, contact } = useSite()
  const year = new Date().getFullYear()

  const socials = Object.entries(brand.socialLinks ?? {}).filter(
    (entry): entry is [keyof typeof SOCIAL_ICONS, string] =>
      Boolean(entry[1]) && entry[0] in SOCIAL_ICONS,
  )

  return (
    <footer className="border-t border-ink-200 bg-ink-50">
      <Container className="py-14">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-600">
              {brand.brandDescription}
            </p>
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink-700 hover:text-brand-700"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                {contact.email}
              </a>
            )}
            {socials.length > 0 && (
              <ul className="mt-5 flex gap-2">
                {socials.map(([key, href]) => {
                  const Icon = SOCIAL_ICONS[key]
                  return (
                    <li key={key}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 transition hover:text-brand-700"
                        aria-label={key}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </a>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <FooterColumn title="Learn" links={footerNavigation.learn} />
          <FooterColumn title="Company" links={footerNavigation.company} />
          <FooterColumn title="Legal" links={footerNavigation.legal} />
        </div>

        {/* Stated plainly, on every page, so the relationship is never ambiguous. */}
        <p className="mt-12 rounded-xl border border-ink-200 bg-white p-4 text-xs leading-relaxed text-ink-500">
          {siteConfig.independenceNotice} Certification and product names are the trademarks of
          their respective owners and are used only to describe the subject matter of our
          preparation material.
        </p>

        <div className="mt-6 flex flex-col gap-3 border-t border-ink-200 pt-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {brand.brandName}. All rights reserved.
          </p>
          <p>
            Built as a learning and certification preparation platform. Exams are administered by
            the certification providers.
          </p>
        </div>
      </Container>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: readonly { readonly label: string; readonly to: string }[]
}) {
  return (
    <nav aria-label={title}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-900">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="text-sm text-ink-600 transition hover:text-brand-700">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
