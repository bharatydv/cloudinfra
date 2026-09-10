import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Restore scroll position on navigation, respecting reduced-motion. */
export function useScrollToTop(): null {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }, [pathname, hash])

  return null
}
