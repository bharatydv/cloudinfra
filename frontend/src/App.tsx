import { lazy, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'

import PublicLayout from '@/layouts/PublicLayout'
import { RedirectIfAuthenticated, RequireAdmin, RequireAuth } from '@/layouts/guards'
import HomePage from '@/pages/public/HomePage'
import { AnalyticsEvent, track } from '@/lib/analytics'

/* Route-level code splitting: the homepage ships on its own. */
const CoursesPage = lazy(() => import('@/pages/public/CoursesPage'))
const CourseDetailPage = lazy(() => import('@/pages/public/CourseDetailPage'))
const CertificationsPage = lazy(() => import('@/pages/public/CertificationsPage'))
const ProviderPage = lazy(() => import('@/pages/public/ProviderPage'))
const CertificationDetailPage = lazy(() => import('@/pages/public/CertificationDetailPage'))
const ResourcesPage = lazy(() => import('@/pages/public/ResourcesPage'))
const ArticlePage = lazy(() => import('@/pages/public/ArticlePage'))
const SearchPage = lazy(() => import('@/pages/public/SearchPage'))
const AboutPage = lazy(() => import('@/pages/public/AboutPage'))
const ContactPage = lazy(() => import('@/pages/public/ContactPage'))
const LegalPage = lazy(() => import('@/pages/public/LegalPage'))
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage'))

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() =>
  import('@/pages/auth/PasswordPages').then((module) => ({ default: module.ForgotPasswordPage })),
)
const ResetPasswordPage = lazy(() =>
  import('@/pages/auth/PasswordPages').then((module) => ({ default: module.ResetPasswordPage })),
)

const DashboardLayout = lazy(() => import('@/layouts/DashboardLayout'))
const DashboardOverviewPage = lazy(() =>
  import('@/pages/dashboard/DashboardPages').then((m) => ({ default: m.DashboardOverviewPage })),
)
const MyCoursesPage = lazy(() =>
  import('@/pages/dashboard/DashboardPages').then((m) => ({ default: m.MyCoursesPage })),
)
const ProgressPage = lazy(() =>
  import('@/pages/dashboard/DashboardPages').then((m) => ({ default: m.ProgressPage })),
)
const SavedCertificationsPage = lazy(() =>
  import('@/pages/dashboard/DashboardPages').then((m) => ({ default: m.SavedCertificationsPage })),
)
const PracticePage = lazy(() =>
  import('@/pages/dashboard/DashboardPages').then((m) => ({ default: m.PracticePage })),
)
const CertificatesPage = lazy(() =>
  import('@/pages/dashboard/DashboardPages').then((m) => ({ default: m.CertificatesPage })),
)
const ProfilePage = lazy(() =>
  import('@/pages/dashboard/DashboardPages').then((m) => ({ default: m.ProfilePage })),
)

const LearnPage = lazy(() => import('@/pages/learn/LearnPage'))

const AdminLayout = lazy(() => import('@/layouts/AdminLayout'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminCoursesPage = lazy(() => import('@/pages/admin/AdminCoursesPage'))
const AdminCourseEditorPage = lazy(() => import('@/pages/admin/AdminCourseEditorPage'))
const AdminArticlesPage = lazy(() =>
  import('@/pages/admin/AdminArticlesPage').then((m) => ({ default: m.AdminArticlesPage })),
)
const AdminArticleEditorPage = lazy(() =>
  import('@/pages/admin/AdminArticlesPage').then((m) => ({ default: m.AdminArticleEditorPage })),
)
const AdminCertificationsPage = lazy(() =>
  import('@/pages/admin/AdminCertificationsPage').then((m) => ({
    default: m.AdminCertificationsPage,
  })),
)
const AdminCertificationEditorPage = lazy(() =>
  import('@/pages/admin/AdminCertificationsPage').then((m) => ({
    default: m.AdminCertificationEditorPage,
  })),
)
const AdminProvidersPage = lazy(() =>
  import('@/pages/admin/AdminCertificationsPage').then((m) => ({ default: m.AdminProvidersPage })),
)
const AdminUsersPage = lazy(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminUsersPage })),
)
const AdminEnrollmentsPage = lazy(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminEnrollmentsPage })),
)
const AdminPaymentsPage = lazy(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminPaymentsPage })),
)
const AdminMessagesPage = lazy(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminMessagesPage })),
)
const AdminFaqsPage = lazy(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminFaqsPage })),
)
const AdminTestimonialsPage = lazy(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminTestimonialsPage })),
)
const AdminCategoriesPage = lazy(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminCategoriesPage })),
)
const AdminSettingsPage = lazy(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminSettingsPage })),
)

function PageViewTracker() {
  const { pathname } = useLocation()
  useEffect(() => {
    track(AnalyticsEvent.PageView)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <PageViewTracker />
      <Routes>
        {/* Public marketing and content */}
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="courses/:slug" element={<CourseDetailPage />} />
          <Route path="certifications" element={<CertificationsPage />} />
          <Route path="certifications/:provider" element={<ProviderPage />} />
          <Route path="certifications/:provider/:slug" element={<CertificationDetailPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="resources/:slug" element={<ArticlePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="privacy" element={<LegalPage />} />
          <Route path="terms" element={<LegalPage />} />
          <Route path="refund-policy" element={<LegalPage />} />
          <Route path="disclaimer" element={<LegalPage />} />
          <Route path="cookie-policy" element={<LegalPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Authentication */}
        <Route element={<RedirectIfAuthenticated />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        <Route path="reset-password" element={<ResetPasswordPage />} />

        {/* Authenticated learner area */}
        <Route element={<RequireAuth />}>
          <Route path="dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardOverviewPage />} />
            <Route path="courses" element={<MyCoursesPage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="certifications" element={<SavedCertificationsPage />} />
            <Route path="practice" element={<PracticePage />} />
            <Route path="certificates" element={<CertificatesPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="learn/:courseSlug" element={<LearnPage />} />
          <Route path="learn/:courseSlug/:lessonSlug" element={<LearnPage />} />
        </Route>

        {/* Admin console */}
        <Route element={<RequireAdmin />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="courses" element={<AdminCoursesPage />} />
            <Route path="courses/new" element={<AdminCourseEditorPage />} />
            <Route path="courses/:id" element={<AdminCourseEditorPage />} />
            <Route path="certifications" element={<AdminCertificationsPage />} />
            <Route path="certifications/new" element={<AdminCertificationEditorPage />} />
            <Route path="certifications/:id" element={<AdminCertificationEditorPage />} />
            <Route path="providers" element={<AdminProvidersPage />} />
            <Route path="articles" element={<AdminArticlesPage />} />
            <Route path="articles/new" element={<AdminArticleEditorPage />} />
            <Route path="articles/:id" element={<AdminArticleEditorPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="faqs" element={<AdminFaqsPage />} />
            <Route path="testimonials" element={<AdminTestimonialsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="enrollments" element={<AdminEnrollmentsPage />} />
            <Route path="payments" element={<AdminPaymentsPage />} />
            <Route path="messages" element={<AdminMessagesPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}
