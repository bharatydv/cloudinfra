/**
 * Document head management.
 *
 * The app is a SPA, so head tags are applied imperatively per route. Every
 * indexable page supplies a title, description, canonical URL, Open Graph and
 * Twitter metadata; private routes are explicitly marked noindex.
 */

import { siteConfig } from '@/config/brand'
import type { SeoMeta } from '@/types/api'

const MANAGED = 'data-seo-managed'

function upsertMeta(attr: 'name' | 'property', key: string, content: string | null) {
  const selector = `meta[${attr}="${key}"]`
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!content) {
    if (element?.hasAttribute(MANAGED)) element.remove()
    return
  }
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attr, key)
    element.setAttribute(MANAGED, 'true')
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function upsertLink(rel: string, href: string | null) {
  const selector = `link[rel="${rel}"]`
  let element = document.head.querySelector<HTMLLinkElement>(selector)
  if (!href) {
    if (element?.hasAttribute(MANAGED)) element.remove()
    return
  }
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', rel)
    element.setAttribute(MANAGED, 'true')
    document.head.appendChild(element)
  }
  element.setAttribute('href', href)
}

function setStructuredData(blocks: Record<string, unknown>[]) {
  document.head
    .querySelectorAll('script[type="application/ld+json"][data-seo-managed]')
    .forEach((node) => node.remove())

  for (const block of blocks) {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute(MANAGED, 'true')
    script.textContent = JSON.stringify(block)
    document.head.appendChild(script)
  }
}

export interface SeoInput {
  title: string
  description?: string | null
  canonicalUrl?: string | null
  ogImage?: string | null
  robots?: string
  structuredData?: Record<string, unknown>[]
  type?: 'website' | 'article'
  siteName?: string
}

export function applySeo(input: SeoInput): void {
  const title = input.title
  document.title = title

  upsertMeta('name', 'description', input.description ?? null)
  upsertMeta('name', 'robots', input.robots ?? 'index,follow')

  const canonical = input.canonicalUrl ?? `${siteConfig.siteUrl}${window.location.pathname}`
  upsertLink('canonical', canonical)

  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', input.description ?? null)
  upsertMeta('property', 'og:type', input.type ?? 'website')
  upsertMeta('property', 'og:url', canonical)
  upsertMeta('property', 'og:image', input.ogImage ?? null)
  upsertMeta('property', 'og:site_name', input.siteName ?? null)

  upsertMeta('name', 'twitter:card', input.ogImage ? 'summary_large_image' : 'summary')
  upsertMeta('name', 'twitter:title', title)
  upsertMeta('name', 'twitter:description', input.description ?? null)
  upsertMeta('name', 'twitter:image', input.ogImage ?? null)

  setStructuredData(input.structuredData ?? [])
}

/** Convert a backend `SeoMeta` payload into head tags. */
export function applyServerSeo(meta: SeoMeta | null | undefined, fallbackTitle: string): void {
  if (!meta) {
    applySeo({ title: fallbackTitle })
    return
  }
  applySeo({
    title: meta.title,
    description: meta.description,
    canonicalUrl: meta.canonical_url,
    ogImage: meta.og_image,
    robots: meta.robots,
    structuredData: meta.structured_data,
  })
}

export const NOINDEX = 'noindex,nofollow'
