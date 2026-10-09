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
  brandName: 'Inferacloud',
  brandTagline: 'Cloud certifications and courses at discounted prices.',
  brandDescription:
    'An independent platform for discovering AWS, Microsoft Azure and Google Cloud certifications, courses and exam preparation resources, with the current price of each.',
  logo: null,
  logoMark: 'IC',
  primaryDomain: 'example.com',
  supportEmail: 'support@example.com',
  socialLinks: {},
}

export const siteConfig = {
  apiBaseUrl: (env.VITE_API_BASE_URL as string | undefined) ?? '/api',
  siteUrl: (env.VITE_SITE_URL as string | undefined) ?? window.location.origin,
  /** Fallback social card for pages and records with no image of their own. */
  defaultOgImage: '/og-default.png',
  /** Kept in sync with the backend disclaimer copy. */
  independenceNotice:
    'We are an independent learning platform. We are not affiliated with, endorsed by, or an authorised training partner of any certification provider, and we do not issue vendor certifications.',
  /**
   * Shown wherever vendor names appear beside prices. Naming a provider
   * describes what the material covers; it is not a claim to represent them.
   */
  trademarkNotice:
    'AWS, Microsoft Azure, Google Cloud and other provider names and marks are trademarks of their respective owners.',
} as const

/**
 * Primary navigation, ordered by what people come here to do: find a
 * certification, find a course, find what either costs today. The logo already
 * links home, so "Home" would only push the useful items further right, and
 * About and Contact live in the footer rather than compete with these.
 */
export const navigation = [
  { label: 'Certifications', to: '/certifications' },
  { label: 'Deals', to: '/deals' },
  { label: 'Schedule an exam', to: '/schedule-exam' },
  { label: 'Courses', to: '/courses' },
  { label: 'Resources', to: '/resources' },
] as const

export const footerNavigation = {
  learn: [
    { label: 'Certifications', to: '/certifications' },
    { label: 'Deals', to: '/deals' },
    { label: 'Schedule an exam', to: '/schedule-exam' },
    { label: 'Earn an exam discount', to: '/challenge' },
    { label: 'All courses', to: '/courses' },
    { label: 'Resources', to: '/resources' },
    { label: 'Search', to: '/search' },
  ],
  company: [
    { label: 'About', to: '/about' },
    { label: 'Contact', to: '/contact' },
    { label: 'Affiliate partnership', to: '/affiliate' },
  ],
  legal: [
    { label: 'Privacy policy', to: '/privacy' },
    { label: 'Terms of service', to: '/terms' },
    { label: 'Refund policy', to: '/refund-policy' },
    { label: 'Disclaimer', to: '/disclaimer' },
    { label: 'Cookie policy', to: '/cookie-policy' },
  ],
} as const
