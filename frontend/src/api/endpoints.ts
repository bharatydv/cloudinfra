/** Typed API surface. One function per backend endpoint the app uses. */

import { api } from '@/api/client'
import type {
  AdminDashboard,
  ArticleCard,
  ArticleCategory,
  ArticleDetail,
  AuthResponse,
  Certificate,
  CertificationCard,
  CertificationDetail,
  CertificationResource,
  ContactMessage,
  CourseCard,
  CourseCategory,
  CourseDetail,
  CourseModule,
  CourseProgress,
  DashboardOverview,
  Enrollment,
  Faq,
  HomePayload,
  LearnCourse,
  Lesson,
  Page,
  Payment,
  ProviderCard,
  ProviderDetail,
  SavedCertification,
  SearchResponse,
  SeoMeta,
  SiteSetting,
  Tag,
  Testimonial,
  User,
} from '@/types/api'

/* -------------------------------------------------------------------------- */
/* Site                                                                       */
/* -------------------------------------------------------------------------- */
export const getHome = () => api.get<HomePayload>('/home', { auth: false })
export const getSettings = () => api.get<SiteSetting[]>('/settings', { auth: false })
export const getFaqs = (category?: string) =>
  api.get<Faq[]>('/faqs', { auth: false, query: { category } })
export const getTestimonials = (limit = 12) =>
  api.get<Testimonial[]>('/testimonials', { auth: false, query: { limit } })
export const getPageSeo = (path: string) =>
  api.get<SeoMeta>('/seo/page', { auth: false, query: { path } })

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */
export interface RegisterPayload {
  name: string
  email: string
  password: string
  confirm_password: string
}

export const register = (payload: RegisterPayload) =>
  api.post<AuthResponse>('/auth/register', payload, { auth: false })

export const login = (payload: { email: string; password: string }) =>
  api.post<AuthResponse>('/auth/login', payload, { auth: false })

export const logout = (refreshToken: string | null) =>
  api.post<{ message: string }>('/auth/logout', { refresh_token: refreshToken ?? '' })

export const getMe = () => api.get<User>('/auth/me')

export const forgotPassword = (email: string) =>
  api.post<{ message: string }>('/auth/forgot-password', { email }, { auth: false })

export const resetPassword = (payload: {
  token: string
  password: string
  confirm_password: string
}) => api.post<{ message: string }>('/auth/reset-password', payload, { auth: false })

export const changePassword = (payload: { current_password: string; new_password: string }) =>
  api.post<{ message: string }>('/auth/change-password', payload)

export const updateProfile = (payload: {
  name?: string
  headline?: string | null
  bio?: string | null
}) => api.put<User>('/users/me', payload)

/* -------------------------------------------------------------------------- */
/* Courses                                                                    */
/* -------------------------------------------------------------------------- */
export interface CourseFilters {
  page?: number
  page_size?: number
  q?: string
  category?: string
  level?: string
  max_duration_minutes?: number
  free_only?: boolean
  min_rating?: number
  sort?: string
}

export const getCourses = (filters: CourseFilters = {}) =>
  api.get<Page<CourseCard>>('/courses', { auth: false, query: { ...filters } })

export const getCourse = (slug: string) => api.get<CourseDetail>(`/courses/${slug}`)

export const getCourseCategories = () =>
  api.get<CourseCategory[]>('/course-categories', { auth: false })

export const getCourseModules = (courseId: string) =>
  api.get<CourseModule[]>(`/courses/${courseId}/modules`, { auth: false })

export const reviewCourse = (
  courseId: string,
  payload: { rating: number; comment?: string },
) => api.post(`/courses/${courseId}/reviews`, payload)

/* -------------------------------------------------------------------------- */
/* Certifications                                                             */
/* -------------------------------------------------------------------------- */
export interface CertificationFilters {
  page?: number
  page_size?: number
  q?: string
  provider?: string
  level?: string
  category?: string
  sort?: string
}

export const getCertifications = (filters: CertificationFilters = {}) =>
  api.get<Page<CertificationCard>>('/certifications', { query: { ...filters } })

export const getProviders = () =>
  api.get<ProviderCard[]>('/certification-providers', { auth: false })

export const getCertificationCategories = () =>
  api.get<string[]>('/certification-categories', { auth: false })

export const getProvider = (slug: string) => api.get<ProviderDetail>(`/certifications/${slug}`)

export const getCertification = (providerSlug: string, slug: string) =>
  api.get<CertificationDetail>(`/certifications/${providerSlug}/${slug}`)

export const getPracticeResources = () =>
  api.get<CertificationResource[]>('/certification-resources/practice', { auth: false })

/* -------------------------------------------------------------------------- */
/* Articles                                                                   */
/* -------------------------------------------------------------------------- */
export interface ArticleFilters {
  page?: number
  page_size?: number
  q?: string
  category?: string
  tag?: string
  featured?: boolean
  sort?: string
}

export const getArticles = (filters: ArticleFilters = {}) =>
  api.get<Page<ArticleCard>>('/articles', { auth: false, query: { ...filters } })

export const getArticle = (slug: string) =>
  api.get<ArticleDetail>(`/articles/${slug}`, { auth: false })

export const getFeaturedArticles = (limit = 3) =>
  api.get<ArticleCard[]>('/articles/featured', { auth: false, query: { limit } })

export const getPopularArticles = (limit = 5) =>
  api.get<ArticleCard[]>('/articles/popular', { auth: false, query: { limit } })

export const getArticleCategories = () =>
  api.get<ArticleCategory[]>('/article-categories', { auth: false })

export const getTags = () => api.get<Tag[]>('/tags', { auth: false })

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */
export const search = (query: string, types?: string[], limit = 20) =>
  api.get<SearchResponse>('/search', {
    auth: false,
    query: { q: query, types, limit },
  })

/* -------------------------------------------------------------------------- */
/* Learning                                                                   */
/* -------------------------------------------------------------------------- */
export const enroll = (courseId: string) =>
  api.post<Enrollment>('/enrollments', { course_id: courseId })

export const getMyEnrollments = () => api.get<Enrollment[]>('/users/me/enrollments')
export const getMyProgress = () => api.get<CourseProgress[]>('/users/me/progress')
export const getMyDashboard = () => api.get<DashboardOverview>('/users/me/dashboard')
export const getMyCertificates = () => api.get<Certificate[]>('/users/me/certificates')

export const getSavedCertifications = () =>
  api.get<SavedCertification[]>('/users/me/saved-certifications')

export const saveCertification = (certificationId: string, notes?: string) =>
  api.post<{ message: string }>('/users/me/saved-certifications', {
    certification_id: certificationId,
    notes,
  })

export const unsaveCertification = (certificationId: string) =>
  api.delete<{ message: string }>(`/users/me/saved-certifications/${certificationId}`)

export const getLearnCourse = (courseSlug: string, lessonSlug?: string) =>
  api.get<LearnCourse>(
    lessonSlug ? `/learn/${courseSlug}/${lessonSlug}` : `/learn/${courseSlug}`,
  )

export const updateLessonProgress = (
  lessonId: string,
  payload: { completed?: boolean; progress_percentage?: number },
) => api.post(`/lessons/${lessonId}/progress`, payload)

export const getLesson = (lessonId: string) => api.get<Lesson>(`/lessons/${lessonId}`)

/* -------------------------------------------------------------------------- */
/* Contact, payments, analytics                                               */
/* -------------------------------------------------------------------------- */
export const submitContact = (payload: {
  name: string
  email: string
  subject: string
  message: string
  website?: string
}) => api.post<{ message: string }>('/contact', payload, { auth: false })

export const createPayment = (courseId: string) =>
  api.post<{
    payment_id: string
    provider: string
    status: string
    checkout_url: string | null
    amount: string
    currency: string
  }>('/payments/create', { course_id: courseId })

export const trackEvent = (payload: {
  event_name: string
  entity_type?: string
  entity_id?: string
  session_id?: string
  path?: string
  properties?: Record<string, unknown>
}) => api.post('/events', payload)

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */
export const getAdminDashboard = () => api.get<AdminDashboard>('/admin/dashboard')

export const getAdminUsers = (query: { page?: number; q?: string; role?: string } = {}) =>
  api.get<Page<User>>('/admin/users', { query })

export const updateAdminUser = (
  userId: string,
  payload: { role?: string; is_active?: boolean },
) => api.put<User>(`/admin/users/${userId}`, payload)

export const getAdminCourses = (query: { page?: number; q?: string } = {}) =>
  api.get<Page<CourseCard>>('/admin/courses', { query })

export const getAdminCourse = (id: string) => api.get<CourseDetail>(`/admin/courses/${id}`)

export const createCourse = (payload: Record<string, unknown>) =>
  api.post<CourseDetail>('/courses', payload)

export const updateCourse = (id: string, payload: Record<string, unknown>) =>
  api.put<CourseDetail>(`/courses/${id}`, payload)

export const publishCourse = (id: string, published: boolean) =>
  api.post<CourseDetail>(`/courses/${id}/publish`, undefined, {
    query: { published },
  })

export const deleteCourse = (id: string) => api.delete(`/courses/${id}`)

export const createModule = (payload: { course_id: string; title: string }) =>
  api.post<CourseModule>('/modules', payload)

export const updateModule = (id: string, payload: Record<string, unknown>) =>
  api.put<CourseModule>(`/modules/${id}`, payload)

export const deleteModule = (id: string) => api.delete(`/modules/${id}`)

export const createLesson = (payload: Record<string, unknown>) =>
  api.post<Lesson>('/lessons', payload)

export const updateLesson = (id: string, payload: Record<string, unknown>) =>
  api.put<Lesson>(`/lessons/${id}`, payload)

export const deleteLesson = (id: string) => api.delete(`/lessons/${id}`)

export const getAdminCertifications = (query: { page?: number; q?: string } = {}) =>
  api.get<Page<CertificationCard>>('/admin/certifications', { query })

export const getAdminCertification = (id: string) =>
  api.get<CertificationDetail>(`/admin/certifications/${id}`)

export const createCertification = (payload: Record<string, unknown>) =>
  api.post<CertificationDetail>('/certifications', payload)

export const updateCertification = (id: string, payload: Record<string, unknown>) =>
  api.put<CertificationDetail>(`/certifications/${id}`, payload)

export const deleteCertification = (id: string) => api.delete(`/certifications/${id}`)

export const createProvider = (payload: Record<string, unknown>) =>
  api.post<ProviderCard>('/certification-providers', payload)

export const updateProvider = (id: string, payload: Record<string, unknown>) =>
  api.put<ProviderCard>(`/certification-providers/${id}`, payload)

export const deleteProvider = (id: string) => api.delete(`/certification-providers/${id}`)

export const createCertificationResource = (payload: Record<string, unknown>) =>
  api.post('/certification-resources', payload)

export const deleteCertificationResource = (id: string) =>
  api.delete(`/certification-resources/${id}`)

export const getAdminArticles = (query: { page?: number; q?: string; status?: string } = {}) =>
  api.get<Page<ArticleCard>>('/admin/articles', { query })

export const getAdminArticle = (id: string) => api.get<ArticleDetail>(`/admin/articles/${id}`)

export const createArticle = (payload: Record<string, unknown>) =>
  api.post<ArticleDetail>('/articles', payload)

export const updateArticle = (id: string, payload: Record<string, unknown>) =>
  api.put<ArticleDetail>(`/articles/${id}`, payload)

export const deleteArticle = (id: string) => api.delete(`/articles/${id}`)

export const getAdminFaqs = () => api.get<Faq[]>('/admin/faqs')
export const createFaq = (payload: Record<string, unknown>) => api.post<Faq>('/admin/faqs', payload)
export const updateFaq = (id: string, payload: Record<string, unknown>) =>
  api.put<Faq>(`/admin/faqs/${id}`, payload)
export const deleteFaq = (id: string) => api.delete(`/admin/faqs/${id}`)

export const getAdminTestimonials = () => api.get<Testimonial[]>('/admin/testimonials')
export const createTestimonial = (payload: Record<string, unknown>) =>
  api.post<Testimonial>('/admin/testimonials', payload)
export const updateTestimonial = (id: string, payload: Record<string, unknown>) =>
  api.put<Testimonial>(`/admin/testimonials/${id}`, payload)
export const deleteTestimonial = (id: string) => api.delete(`/admin/testimonials/${id}`)

export const getAdminEnrollments = (query: { page?: number } = {}) =>
  api.get<Page<Enrollment>>('/admin/enrollments', { query })

export const getAdminPayments = (query: { page?: number } = {}) =>
  api.get<Page<Payment>>('/admin/payments', { query })

export const getAdminMessages = (query: { page?: number; message_status?: string } = {}) =>
  api.get<Page<ContactMessage>>('/admin/messages', { query })

export const updateMessage = (
  id: string,
  payload: { status?: string; admin_notes?: string },
) => api.put<ContactMessage>(`/admin/messages/${id}`, payload)

export const deleteMessage = (id: string) => api.delete(`/admin/messages/${id}`)

export const getAdminSettings = () => api.get<SiteSetting[]>('/admin/settings')

export const updateSetting = (
  key: string,
  payload: { value: Record<string, unknown>; is_public?: boolean },
) => api.put<SiteSetting>(`/admin/settings/${key}`, payload)

export const lookupCourses = () =>
  api.get<Array<{ id: string; title: string; slug: string }>>('/admin/lookup/courses')

export const lookupCertifications = () =>
  api.get<Array<{ id: string; name: string; slug: string }>>('/admin/lookup/certifications')
