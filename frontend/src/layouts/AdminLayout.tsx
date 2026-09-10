import { Suspense, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Award,
  BookOpen,
  CreditCard,
  FileText,
  FolderTree,
  Gauge,
  HelpCircle,
  Mail,
  Menu,
  MessageSquareQuote,
  Settings,
  Building2,
  Users,
  X,
} from 'lucide-react'

import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { InlineSpinner } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import { useScrollToTop } from '@/hooks/useScrollToTop'
import { useSeo } from '@/hooks/useSeo'
import { NOINDEX } from '@/lib/seo'
import { cn } from '@/lib/cn'

const SECTIONS = [
  {
    title: 'Overview',
    links: [{ to: '/admin', label: 'Dashboard', icon: Gauge, end: true }],
  },
  {
    title: 'Content',
    links: [
      { to: '/admin/courses', label: 'Courses', icon: BookOpen },
      { to: '/admin/certifications', label: 'Certifications', icon: Award },
      { to: '/admin/providers', label: 'Providers', icon: Building2 },
      { to: '/admin/articles', label: 'Articles', icon: FileText },
      { to: '/admin/categories', label: 'Categories', icon: FolderTree },
      { to: '/admin/faqs', label: 'FAQs', icon: HelpCircle },
      { to: '/admin/testimonials', label: 'Testimonials', icon: MessageSquareQuote },
    ],
  },
  {
    title: 'Operations',
    links: [
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/enrollments', label: 'Enrollments', icon: BookOpen },
      { to: '/admin/payments', label: 'Payments', icon: CreditCard },
      { to: '/admin/messages', label: 'Messages', icon: Mail },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  useScrollToTop()
  useSeo({ title: 'Admin', robots: NOINDEX })

  return (
    <div className="flex min-h-screen bg-ink-50">
      <a href="#admin-main" className="skip-link">
        Skip to main content
      </a>

      {/* Data-dense sidebar: fixed on desktop, drawer on mobile. */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto border-r border-ink-800 bg-ink-950 transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-ink-800 px-5">
          <Logo tone="inverse" />
          <button
            type="button"
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Admin" className="px-3 py-5">
          {SECTIONS.map((section) => (
            <div key={section.title} className="mb-6">
              <p className="px-3 pb-2 text-[0.6875rem] font-bold uppercase tracking-widest text-ink-500">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.links.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      end={'end' in link ? link.end : undefined}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                          isActive
                            ? 'bg-brand-600 text-white'
                            : 'text-ink-400 hover:bg-ink-800 hover:text-white',
                        )
                      }
                    >
                      <link.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink-950/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-ink-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="text-sm font-semibold text-ink-900">Administration</p>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-ink-600 sm:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </header>

        <main id="admin-main" className="min-w-0 flex-1 p-4 sm:p-6">
          <Suspense fallback={<InlineSpinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
