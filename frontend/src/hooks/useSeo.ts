import { useEffect } from 'react'

import { useBrand } from '@/hooks/useSite'
import { applySeo, applyServerSeo, type SeoInput } from '@/lib/seo'
import type { SeoMeta } from '@/types/api'

/** Apply head tags for a page whose metadata is known client-side. */
export function useSeo(input: SeoInput | null) {
  const brand = useBrand()

  useEffect(() => {
    if (!input) return
    applySeo({
      ...input,
      title: input.title.includes(brand.brandName)
        ? input.title
        : `${input.title} | ${brand.brandName}`,
      siteName: brand.brandName,
    })
    // Serialising keeps the effect stable across re-renders with equal input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(input), brand.brandName])
}

/** Apply head tags built by the API for a database-backed page. */
export function useServerSeo(meta: SeoMeta | null | undefined, fallbackTitle: string) {
  const brand = useBrand()

  useEffect(() => {
    if (meta) {
      applyServerSeo(
        { ...meta, title: `${meta.title} | ${brand.brandName}` },
        `${fallbackTitle} | ${brand.brandName}`,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, brand.brandName, fallbackTitle])
}
