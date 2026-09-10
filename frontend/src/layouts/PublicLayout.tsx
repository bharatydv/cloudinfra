import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'

import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { InlineSpinner } from '@/components/ui/states'
import { useScrollToTop } from '@/hooks/useScrollToTop'

export default function PublicLayout() {
  useScrollToTop()

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        <Suspense fallback={<InlineSpinner label="Loading page" />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
