/** Types mirroring the FastAPI response models. */

export type UserRole = 'student' | 'instructor' | 'admin'
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced'
export type CertificationLevel =
  | 'foundational'
  | 'associate'
  | 'professional'
  | 'specialty'
  | 'expert'
export type ContentStatus = 'draft' | 'scheduled' | 'published' | 'archived'
export type EnrollmentStatus = 'active' | 'completed' | 'cancelled'
export type ContactStatus = 'new' | 'read' | 'resolved'
export type PaymentStatus = 'pending' | 'successful' | 'failed' | 'refunded'
export type ResourceType =
  | 'guide'
  | 'roadmap'
  | 'practice'
  | 'cheatsheet'
  | 'exam_topic'
  | 'external'
export type SearchEntity = 'course' | 'certification' | 'article' | 'resource'

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
  has_next: boolean
  has_previous: boolean
}

export interface Breadcrumb {
  name: string
  url: string
}

export interface SeoMeta {
  title: string
  description: string | null
  canonical_url: string | null
  og_image: string | null
  robots: string
  breadcrumbs: Breadcrumb[]
  structured_data: Record<string, unknown>[]
}

export interface FaqItem {
  question: string
  answer: string
}

export interface TocEntry {
  level: number
  title: string
  anchor: string
}

/* -------------------------------------------------------------------------- */
/* Users & auth                                                               */
/* -------------------------------------------------------------------------- */
export interface UserPublic {
  id: string
  name: string
  headline: string | null
  profile_image: string | null
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  profile_image: string | null
  headline: string | null
  bio: string | null
  is_active: boolean
  is_email_verified: boolean
  created_at: string
  last_login_at: string | null
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface AuthResponse {
  user: User
  tokens: TokenPair
}

/* -------------------------------------------------------------------------- */
/* Catalog                                                                    */
/* -------------------------------------------------------------------------- */
export interface CourseCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  position: number
  course_count: number
}

export interface CourseCard {
  id: string
  title: string
  slug: string
  short_description: string
  thumbnail: string | null
  icon: string | null
  level: CourseLevel
  duration_minutes: number
  price: string
  currency: string
  rating_average: string
  rating_count: number
  enrollment_count: number
  lesson_count: number
  is_published: boolean
  is_free: boolean
  category: { id: string; name: string; slug: string } | null
}

export interface LessonSummary {
  id: string
  title: string
  slug: string
  duration_minutes: number
  position: number
  is_preview: boolean
}

export interface Lesson extends LessonSummary {
  module_id: string
  description: string | null
  video_url: string | null
  content: string
  resources: Array<Record<string, unknown>>
}

export interface CourseModule {
  id: string
  course_id: string
  title: string
  description: string | null
  position: number
  lessons: LessonSummary[]
}

export interface CourseReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
  user: UserPublic
}

export interface CertificationCardRef {
  id: string
  name: string
  slug: string
  provider_slug: string
  provider_name: string
  level: string
  exam_code: string | null
}

export interface CourseDetail extends CourseCard {
  description: string
  language: string
  learning_outcomes: string[]
  requirements: string[]
  is_featured: boolean
  created_at: string
  updated_at: string
  instructor: UserPublic | null
  modules: CourseModule[]
  faqs: FaqItem[]
  reviews: CourseReview[]
  related_certifications: CertificationCardRef[]
  related_courses: CourseCard[]
  seo: SeoMeta | null
  is_enrolled: boolean
  progress_percentage: number
}

/* -------------------------------------------------------------------------- */
/* Certifications                                                             */
/* -------------------------------------------------------------------------- */
export interface ProviderCard {
  id: string
  name: string
  slug: string
  short_description: string | null
  logo: string | null
  accent_color: string | null
  certification_count: number
}

export interface CertificationCard {
  id: string
  name: string
  slug: string
  short_description: string
  exam_code: string | null
  level: CertificationLevel
  category: string | null
  skills: string[]
  provider_id: string
  provider_name: string
  provider_slug: string
  provider_logo: string | null
  course_count: number
  is_saved: boolean
}

export interface CertificationResource {
  id: string
  certification_id: string
  title: string
  slug: string
  resource_type: ResourceType
  description: string | null
  url: string | null
  estimated_minutes: number | null
  position: number
  content: string
}

export interface ExamTopic {
  title: string
  weight: number | null
  items: string[]
}

export interface RoadmapStep {
  step: number
  title: string
  description: string | null
  estimated_weeks: number | null
}

export interface CertificationDetail extends CertificationCard {
  description: string
  audience: string | null
  recommended_experience: string | null
  exam_topics: ExamTopic[]
  preparation_roadmap: RoadmapStep[]
  exam_duration_minutes: number | null
  exam_format: string | null
  official_url: string | null
  created_at: string
  updated_at: string
  provider: ProviderCard | null
  resources: CertificationResource[]
  practice_resources: CertificationResource[]
  related_courses: CourseCard[]
  related_certifications: CertificationCard[]
  faqs: FaqItem[]
  seo: SeoMeta | null
}

export interface ArticleCardRef {
  id: string
  title: string
  slug: string
  excerpt: string
  reading_minutes: number
  published_at: string | null
}

export interface ProviderDetail extends ProviderCard {
  description: string | null
  website_url: string | null
  is_official_partner: boolean
  certifications: CertificationCard[]
  related_courses: CourseCard[]
  related_articles: ArticleCardRef[]
  faqs: FaqItem[]
  seo: SeoMeta | null
}

/* -------------------------------------------------------------------------- */
/* Content                                                                    */
/* -------------------------------------------------------------------------- */
export interface ArticleCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  position: number
  article_count: number
}

export interface Tag {
  id: string
  name: string
  slug: string
}

export interface ArticleCard {
  id: string
  title: string
  slug: string
  excerpt: string
  featured_image: string | null
  reading_minutes: number
  is_featured: boolean
  published_at: string | null
  updated_at: string
  author: UserPublic | null
  category: ArticleCategory | null
  tags: Tag[]
}

export interface ArticleDetail extends ArticleCard {
  content: string
  view_count: number
  status: ContentStatus
  created_at: string
  canonical_url: string | null
  table_of_contents: TocEntry[]
  faq: FaqItem[]
  related_articles: ArticleCard[]
  related_courses: CourseCard[]
  related_certifications: CertificationCard[]
  seo: SeoMeta | null
}

export interface Faq {
  id: string
  question: string
  answer: string
  category: string
  position: number
  is_published: boolean
}

export interface Testimonial {
  id: string
  user_name: string
  role: string | null
  content: string
  rating: number
  image: string | null
  position: number
  is_demo: boolean
}

/* -------------------------------------------------------------------------- */
/* Learning                                                                   */
/* -------------------------------------------------------------------------- */
export interface Enrollment {
  id: string
  course_id: string
  status: EnrollmentStatus
  progress_percentage: number
  enrolled_at: string
  completed_at: string | null
  last_accessed_at: string | null
  course: CourseCard | null
}

export interface CourseProgress {
  course_id: string
  course_slug: string
  course_title: string
  total_lessons: number
  completed_lessons: number
  progress_percentage: number
  status: EnrollmentStatus
  last_accessed_at: string | null
  next_lesson_slug: string | null
}

export interface DashboardOverview {
  enrolled_courses: number
  completed_courses: number
  in_progress_courses: number
  total_lessons_completed: number
  saved_certifications: number
  certificates_earned: number
  overall_progress: number
  recent_courses: CourseProgress[]
}

export interface Certificate {
  id: string
  serial: string
  issued_at: string
  course: CourseCard | null
}

export interface SavedCertification {
  id: string
  created_at: string
  notes: string | null
  certification: CertificationCard
}

export interface LearnLesson {
  id: string
  module_id: string
  title: string
  slug: string
  description: string | null
  video_url: string | null
  content: string
  resources: Array<Record<string, unknown>>
  duration_minutes: number
  position: number
  completed: boolean
  progress_percentage: number
  previous_lesson_slug: string | null
  next_lesson_slug: string | null
}

export interface LearnModuleLesson {
  id: string
  title: string
  slug: string
  duration_minutes: number
  position: number
  completed?: boolean
  progress_percentage?: number
}

export interface LearnModule {
  id: string
  title: string
  position: number
  lessons: LearnModuleLesson[]
}

export interface LearnCourse {
  course_id: string
  title: string
  slug: string
  progress_percentage: number
  total_lessons: number
  completed_lessons: number
  modules: LearnModule[]
  current_lesson: LearnLesson | null
}

/* -------------------------------------------------------------------------- */
/* Site / search / admin                                                      */
/* -------------------------------------------------------------------------- */
export interface HomePayload {
  categories: CourseCategory[]
  featured_courses: CourseCard[]
  featured_certifications: CertificationCard[]
  providers: ProviderCard[]
  latest_articles: ArticleCard[]
  testimonials: Testimonial[]
  faqs: Faq[]
  seo: SeoMeta
}

export interface SiteSetting {
  key: string
  value: Record<string, unknown>
  description: string | null
  is_public: boolean
}

export interface SearchResult {
  type: SearchEntity
  id: string
  title: string
  description: string
  url: string
  category: string | null
  metadata: Record<string, unknown>
  rank: number
}

export interface SearchResponse {
  query: string
  total: number
  results: SearchResult[]
  counts: Record<string, number>
}

export interface ContactMessage {
  id: string
  name: string
  email: string
  subject: string
  message: string
  status: ContactStatus
  admin_notes: string | null
  created_at: string
}

export interface Payment {
  id: string
  course_id: string | null
  amount: string
  currency: string
  payment_provider: string
  transaction_id: string | null
  status: PaymentStatus
  paid_at: string | null
  created_at: string
}

export interface AdminDashboard {
  stats: {
    users: number
    students: number
    courses: number
    published_courses: number
    certifications: number
    articles: number
    published_articles: number
    enrollments: number
    active_enrollments: number
    contact_messages: number
    new_contact_messages: number
    revenue_total: string
    revenue_currency: string
  }
  recent_users: Array<{
    id: string
    name: string
    email: string
    role: string
    created_at: string
  }>
  recent_enrollments: Array<{
    id: string
    user_name: string
    course_title: string
    status: string
    enrolled_at: string
  }>
  recent_messages: ContactMessage[]
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: Array<{ field: string; message: string }> | unknown
  }
}
