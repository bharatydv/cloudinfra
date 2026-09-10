import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getSettings } from '@/api/endpoints'
import { defaultBrand, type Brand } from '@/config/brand'
import { queryKeys } from '@/lib/queryClient'
import type { SiteSetting } from '@/types/api'

interface ContactDetails {
  email: string | null
  phone: string | null
  address: string | null
  responseTime: string | null
}

interface LearningPathStep {
  title: string
  description: string
}

interface SiteContextValue {
  brand: Brand
  contact: ContactDetails
  about: Record<string, unknown>
  legal: Record<string, string>
  learningPath: LearningPathStep[]
  isLoading: boolean
}

const SiteContext = createContext<SiteContextValue | null>(null)

function settingValue(settings: SiteSetting[] | undefined, key: string): Record<string, unknown> {
  return settings?.find((item) => item.key === key)?.value ?? {}
}

export function SiteProvider({ children }: { children: ReactNode }) {
  // Site copy is database-driven so it can change without a deploy.
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: getSettings,
    staleTime: 10 * 60_000,
  })

  const value = useMemo<SiteContextValue>(() => {
    const brandSetting = settingValue(data, 'brand')
    const contactSetting = settingValue(data, 'contact')
    const pathSetting = settingValue(data, 'learning_path')

    return {
      brand: { ...defaultBrand, ...(brandSetting as Partial<Brand>) },
      contact: {
        email: (contactSetting.email as string) ?? null,
        phone: (contactSetting.phone as string) ?? null,
        address: (contactSetting.address as string) ?? null,
        responseTime: (contactSetting.responseTime as string) ?? null,
      },
      about: settingValue(data, 'about'),
      legal: settingValue(data, 'legal') as Record<string, string>,
      learningPath: (pathSetting.steps as LearningPathStep[]) ?? [],
      isLoading,
    }
  }, [data, isLoading])

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSite(): SiteContextValue {
  const context = useContext(SiteContext)
  if (!context) throw new Error('useSite must be used inside <SiteProvider>')
  return context
}

export function useBrand(): Brand {
  return useSite().brand
}
