/**
 * Single source of truth for brand identity.
 *
 * Nothing in the component tree hardcodes the brand: components read from
 * `useBrand()`, which merges these defaults with the `brand` site setting
 * loaded from the API. Rebranding is therefore either an env change or an
 * admin edit -- never a code change.
 */

export interface SocialLinks {
  linkedin?: string | null
  x?: string | null
  youtube?: string | null
  github?: string | null
}

export interface Brand {
  brandName: string
  brandTagline: string
  brandDescription: string
  logo: string | null
  /** Short monogram used when no logo image is configured. */
  logoMark: string
  primaryDomain: string
  supportEmail: string
  socialLinks: SocialLinks
}

const env = import.meta.env

export const defaultBrand: Brand = {
  brandName: 'LearnBase',
  brandTagline: 'Learn. Get Certified. Build Your Future.',
  brandDescription:
    'Structured courses and independent certification preparation resources for cloud, AI, data and DevOps careers.',
  logo: null,
  logoMark: 'LB',
  primaryDomain: 'example.com',
  supportEmail: 'support@example.com',
  socialLinks: {},
}

export const siteConfig = {
  apiBaseUrl: (env.VITE_API_BASE_URL as string | undefined) ?? '/api',
  siteUrl: (env.VITE_SITE_URL as string | undefined) ?? window.location.origin,
  /** Kept in sync with the backend disclaimer copy. */
  independenceNotice:
    'We are an independent learning platform. We are not affiliated with, endorsed by, or an authorised training partner of any certification provider, and we do not issue vendor certifications.',
} as const

export const navigation = [
  { label: 'Home', to: '/' },
  { label: 'Certifications', to: '/certifications' },
  { label: 'Courses', to: '/courses' },
  { label: 'Resources', to: '/resources' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
] as const

export const footerNavigation = {
  learn: [
    { label: 'All courses', to: '/courses' },
    { label: 'Certifications', to: '/certifications' },
    { label: 'Resources', to: '/resources' },
    { label: 'Search', to: '/search' },
  ],
  company: [
    { label: 'About', to: '/about' },
    { label: 'Contact', to: '/contact' },
  ],
  legal: [
    { label: 'Privacy policy', to: '/privacy' },
    { label: 'Terms of service', to: '/terms' },
    { label: 'Refund policy', to: '/refund-policy' },
    { label: 'Disclaimer', to: '/disclaimer' },
    { label: 'Cookie policy', to: '/cookie-policy' },
  ],
} as const
