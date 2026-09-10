import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LogOut, Menu, Search, Shield, User as UserIcon, X } from 'lucide-react'

import { Logo } from '@/components/layout/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Avatar, Container } from '@/components/ui/primitives'
import { navigation } from '@/config/brand'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, isAdmin, logout } = useAuth()

  // Subtle elevation once the page moves away from the top.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setAccountOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!accountOpen) return
    function onPointerDown(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountOpen])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative rounded-lg px-3 py-2 text-sm font-medium transition',
      isActive ? 'text-brand-700' : 'text-ink-600 hover:text-ink-900',
    )

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b bg-white/90 backdrop-blur-md transition-shadow duration-200',
        scrolled ? 'border-ink-200 shadow-subtle' : 'border-transparent',
      )}
    >
      <Container>
        <nav className="flex h-16 items-center justify-between gap-4" aria-label="Main">
          <Logo />

          <ul className="hidden items-center gap-0.5 lg:flex">
            {navigation.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === '/'} className={linkClass}>
                  {({ isActive }) => (
                    <>
                      {item.label}
                      {/* Active state is an underline as well as colour. */}
                      <span
                        className={cn(
                          'absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-600 transition-opacity',
                          isActive ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden="true"
                      />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <Link
              to="/search"
              className="rounded-lg p-2.5 text-ink-600 transition hover:bg-ink-100 hover:text-ink-900"
              aria-label="Search"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Link>

            {isAuthenticated ? (
              <div className="relative hidden lg:block" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-ink-100"
                >
                  <Avatar name={user?.name ?? ''} src={user?.profile_image} size="sm" />
                  <span className="max-w-[8rem] truncate text-sm font-medium text-ink-800">
                    {user?.name}
                  </span>
                </button>
                {accountOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-56 animate-slide-down overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-lifted"
                  >
                    <Link
                      to="/dashboard"
                      role="menuitem"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50"
                    >
                      <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                      Dashboard
                    </Link>
                    <Link
                      to="/dashboard/profile"
                      role="menuitem"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50"
                    >
                      <UserIcon className="h-4 w-4" aria-hidden="true" />
                      Profile
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        role="menuitem"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50"
                      >
                        <Shield className="h-4 w-4" aria-hidden="true" />
                        Admin
                      </Link>
                    )}
                    <div className="my-1 border-t border-ink-200" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink-700 hover:bg-ink-50"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <ButtonLink to="/login" variant="ghost" size="sm">
                  Log in
                </ButtonLink>
                <ButtonLink to="/register" size="sm">
                  Get started
                </ButtonLink>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="rounded-lg p-2.5 text-ink-700 transition hover:bg-ink-100 lg:hidden"
            >
              {menuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </nav>
      </Container>

      {menuOpen && (
        <div
          id="mobile-menu"
          className="animate-slide-down border-t border-ink-200 bg-white lg:hidden"
        >
          <Container className="py-4">
            <ul className="flex flex-col gap-1">
              {navigation.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-lg px-3 py-3 text-base font-medium transition',
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-ink-700 hover:bg-ink-50',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-col gap-2 border-t border-ink-200 pt-4">
              {isAuthenticated ? (
                <>
                  <ButtonLink to="/dashboard" variant="outline" fullWidth>
                    Dashboard
                  </ButtonLink>
                  {isAdmin && (
                    <ButtonLink to="/admin" variant="ghost" fullWidth>
                      Admin
                    </ButtonLink>
                  )}
                  <Button variant="ghost" fullWidth onClick={handleLogout}>
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <ButtonLink to="/login" variant="outline" fullWidth>
                    Log in
                  </ButtonLink>
                  <ButtonLink to="/register" fullWidth>
                    Get started
                  </ButtonLink>
                </>
              )}
            </div>
          </Container>
        </div>
      )}
    </header>
  )
}
