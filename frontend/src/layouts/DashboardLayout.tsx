import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Award,
  BookOpen,
  Bookmark,
  LayoutDashboard,
  Target,
  TrendingUp,
  UserCircle,
} from 'lucide-react'

import { Navbar } from '@/components/layout/Navbar'
import { Container } from '@/components/ui/primitives'
import { InlineSpinner } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import { useScrollToTop } from '@/hooks/useScrollToTop'
import { useSeo } from '@/hooks/useSeo'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/cn'

const LINKS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/courses', label: 'My courses', icon: BookOpen },
  { to: '/dashboard/progress', label: 'Learning progress', icon: TrendingUp },
  { to: '/dashboard/certifications', label: 'Saved certifications', icon: Bookmark },
  { to: '/dashboard/practice', label: 'Practice', icon: Target },
  { to: '/dashboard/certificates', label: 'Certificates', icon: Award },
  { to: '/dashboard/profile', label: 'Profile', icon: UserCircle },
]

export default function DashboardLayout() {
  const { user } = useAuth()
  useScrollToTop()
  // Private surfaces are never indexed.
  useSeo({ title: 'Dashboard', robots: NOINDEX })

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <Navbar />

      <Container className="w-full flex-1 py-8">
        <header className="mb-6">
          <h1 className="text-heading-lg text-ink-900">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            Track your progress, continue a course, and manage your account.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Dashboard" className="lg:sticky lg:top-24 lg:self-start">
            {/* Horizontal scroller on small screens, sidebar on large. */}
            <ul className="scroll-x flex gap-1.5 lg:flex-col">
              {LINKS.map((link) => (
                <li key={link.to} className="shrink-0">
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-sm font-medium transition',
                        isActive
                          ? 'bg-white text-brand-700 shadow-subtle ring-1 ring-brand-100'
                          : 'text-ink-600 hover:bg-white/70 hover:text-ink-900',
                      )
                    }
                  >
                    <link.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <main id="main" className="min-w-0">
            <Suspense fallback={<InlineSpinner />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </Container>
    </div>
  )
}
