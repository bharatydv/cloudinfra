import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'

import App from '@/App'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthProvider } from '@/hooks/useAuth'
import { SiteProvider } from '@/hooks/useSite'
import { ToastProvider } from '@/hooks/useToast'
import { queryClient } from '@/lib/queryClient'

import '@/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SiteProvider>
            <ToastProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ToastProvider>
          </SiteProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
