import { QueryClient } from '@tanstack/react-query'

import { ApiError } from '@/api/client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry an auth or not-found response.
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
    },
    mutations: { retry: false },
  },
})

export const queryKeys = {
  home: ['home'] as const,
  settings: ['settings'] as const,
  faqs: (category?: string) => ['faqs', category ?? 'all'] as const,
  courses: (filters: unknown) => ['courses', filters] as const,
  course: (slug: string) => ['course', slug] as const,
  courseCategories: ['course-categories'] as const,
  certifications: (filters: unknown) => ['certifications', filters] as const,
  certification: (provider: string, slug: string) => ['certification', provider, slug] as const,
  providers: ['providers'] as const,
  provider: (slug: string) => ['provider', slug] as const,
  certificationCategories: ['certification-categories'] as const,
  practiceResources: ['practice-resources'] as const,
  articles: (filters: unknown) => ['articles', filters] as const,
  article: (slug: string) => ['article', slug] as const,
  articleCategories: ['article-categories'] as const,
  featuredArticles: ['articles', 'featured'] as const,
  popularArticles: ['articles', 'popular'] as const,
  search: (query: string, types: string[]) => ['search', query, types] as const,
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  enrollments: ['enrollments'] as const,
  progress: ['progress'] as const,
  certificates: ['certificates'] as const,
  savedCertifications: ['saved-certifications'] as const,
  learn: (course: string, lesson?: string) => ['learn', course, lesson ?? 'resume'] as const,
  adminDashboard: ['admin', 'dashboard'] as const,
  adminUsers: (query: unknown) => ['admin', 'users', query] as const,
  adminCourses: (query: unknown) => ['admin', 'courses', query] as const,
  adminCourse: (id: string) => ['admin', 'course', id] as const,
  adminCertifications: (query: unknown) => ['admin', 'certifications', query] as const,
  adminArticles: (query: unknown) => ['admin', 'articles', query] as const,
  adminArticle: (id: string) => ['admin', 'article', id] as const,
  adminFaqs: ['admin', 'faqs'] as const,
  adminTestimonials: ['admin', 'testimonials'] as const,
  adminEnrollments: (query: unknown) => ['admin', 'enrollments', query] as const,
  adminPayments: (query: unknown) => ['admin', 'payments', query] as const,
  adminMessages: (query: unknown) => ['admin', 'messages', query] as const,
  adminSettings: ['admin', 'settings'] as const,
}
