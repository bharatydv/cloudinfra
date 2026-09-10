import { Link } from 'react-router-dom'
import { Compass, Home, Search } from 'lucide-react'

import { ButtonLink } from '@/components/ui/Button'
import { Container } from '@/components/ui/primitives'
import { useSeo } from '@/hooks/useSeo'
import { NOINDEX } from '@/lib/seo'

const SUGGESTIONS = [
  { to: '/courses', label: 'Browse all courses' },
  { to: '/certifications', label: 'Explore certifications' },
  { to: '/resources', label: 'Read guides and roadmaps' },
]

export default function NotFoundPage() {
  useSeo({ title: 'Page not found', robots: NOINDEX })

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Compass className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="mt-6 text-sm font-bold uppercase tracking-widest text-brand-600">Error 404</p>
      <h1 className="mt-2 text-heading-lg text-ink-900 sm:text-4xl">Page not found</h1>
      <p className="mt-4 max-w-md text-base text-ink-600">
        The page you are looking for does not exist, or it may have moved.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink to="/" leadingIcon={<Home className="h-4 w-4" aria-hidden="true" />}>
          Back to home
        </ButtonLink>
        <ButtonLink
          to="/search"
          variant="outline"
          leadingIcon={<Search className="h-4 w-4" aria-hidden="true" />}
        >
          Search the site
        </ButtonLink>
      </div>

      <ul className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
        {SUGGESTIONS.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="text-brand-700 underline underline-offset-4">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  )
}
