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

/** Site-wide marketing offer, edited from Admin > Settings. */
export interface Promotion {
  enabled: boolean
  message: string
  /** Short label shown on the scheduling CTA, e.g. "Save 20%". */
  badge: string
  linkLabel: string
  linkTo: string
  /** Free text; blank hides the deadline line. */
  endsOn: string
  /** Value points shown beside an exam price. Operator-owned copy. */
  benefits: string[]
  /** One line under the booking CTA, e.g. when payment is taken. */
  reassurance: string
}

const NO_PROMOTION: Promotion = {
  enabled: false,
  message: '',
  badge: '',
  linkLabel: '',
  linkTo: '/schedule-exam',
  endsOn: '',
  benefits: [],
  reassurance: '',
}

interface LearningPathStep {
  title: string
  description: string
}

interface SiteContextValue {
  brand: Brand
  contact: ContactDetails
  promotion: Promotion
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
    const promoSetting = settingValue(data, 'promotion') as Partial<Promotion>

    return {
      brand: { ...defaultBrand, ...(brandSetting as Partial<Brand>) },
      contact: {
        email: (contactSetting.email as string) ?? null,
        phone: (contactSetting.phone as string) ?? null,
        address: (contactSetting.address as string) ?? null,
        responseTime: (contactSetting.responseTime as string) ?? null,
      },
      // A promotion with no message is treated as switched off, so clearing the
      // text in the admin is enough to take the banner down.
      promotion: {
        ...NO_PROMOTION,
        benefits: Array.isArray(promoSetting.benefits) ? promoSetting.benefits : [],
        reassurance: promoSetting.reassurance ?? '',
        // The offer itself is separate: an empty message means no offer, but
        // the value points still belong beside the price.
        ...(promoSetting.enabled && promoSetting.message ? promoSetting : {}),
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
