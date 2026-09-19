import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'

import PublicLayout from '@/layouts/PublicLayout'
import { lazyImport } from '@/lib/lazyImport'
import { RedirectIfAuthenticated, RequireAdmin, RequireAuth } from '@/layouts/guards'
import HomePage from '@/pages/public/HomePage'
import { AnalyticsEvent, track } from '@/lib/analytics'

/* Route-level code splitting: the homepage ships on its own. */
const CoursesPage = lazyImport(() => import('@/pages/public/CoursesPage'))
const CourseDetailPage = lazyImport(() => import('@/pages/public/CourseDetailPage'))
const CertificationsPage = lazyImport(() => import('@/pages/public/CertificationsPage'))
const ProviderPage = lazyImport(() => import('@/pages/public/ProviderPage'))
const CertificationDetailPage = lazyImport(() => import('@/pages/public/CertificationDetailPage'))
const ScheduleExamPage = lazyImport(() => import('@/pages/public/ScheduleExamPage'))
const ChallengePage = lazyImport(() => import('@/pages/public/ChallengePage'))
const ResourcesPage = lazyImport(() => import('@/pages/public/ResourcesPage'))
const ArticlePage = lazyImport(() => import('@/pages/public/ArticlePage'))
const SearchPage = lazyImport(() => import('@/pages/public/SearchPage'))
const AboutPage = lazyImport(() => import('@/pages/public/AboutPage'))
const ContactPage = lazyImport(() => import('@/pages/public/ContactPage'))
const LegalPage = lazyImport(() => import('@/pages/public/LegalPage'))
const NotFoundPage = lazyImport(() => import('@/pages/public/NotFoundPage'))

const LoginPage = lazyImport(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazyImport(() => import('@/pages/auth/RegisterPage'))
const VerifyEmailPage = lazyImport(() => import('@/pages/auth/VerifyEmailPage'))
const ForgotPasswordPage = lazyImport(() =>
  import('@/pages/auth/PasswordPages').then((module) => ({ default: module.ForgotPasswordPage })),
)
const ResetPasswordPage = lazyImport(() =>
  import('@/pages/auth/PasswordPages').then((module) => ({ default: module.ResetPasswordPage })),
)

const DashboardLayout = lazyImport(() => import('@/layouts/DashboardLayout'))
const DashboardOverviewPage = lazyImport(() =>
  import('@/pages/dashboard/DashboardPages').then((m) => ({ default: m.DashboardOverviewPage })),
)
const MyCoursesPage = lazyImport(() =>
  import('@/pages/dashboard/DashboardPages').then((m) => ({ default: m.MyCoursesPage })),
)
const ProgressPage = lazyImport(() =>
  import('@/pages/dashboard/DashboardPages').then((m) => ({ default: m.ProgressPage })),
)
const SavedCertificationsPage = lazyImport(() =>
  import('@/pages/dashboard/DashboardPages').then((m) => ({ default: m.SavedCertificationsPage })),
)
const PracticePage = lazyImport(() =>
  import('@/pages/dashboard/DashboardPages').then((m) => ({ default: m.PracticePage })),
)
const CertificatesPage = lazyImport(() =>
  import('@/pages/dashboard/DashboardPages').then((m) => ({ default: m.CertificatesPage })),
)
const ProfilePage = lazyImport(() =>
  import('@/pages/dashboard/DashboardPages').then((m) => ({ default: m.ProfilePage })),
)

const LearnPage = lazyImport(() => import('@/pages/learn/LearnPage'))

const AdminLayout = lazyImport(() => import('@/layouts/AdminLayout'))
const AdminDashboardPage = lazyImport(() => import('@/pages/admin/AdminDashboardPage'))
const AdminCoursesPage = lazyImport(() => import('@/pages/admin/AdminCoursesPage'))
const AdminCourseEditorPage = lazyImport(() => import('@/pages/admin/AdminCourseEditorPage'))
const AdminArticlesPage = lazyImport(() =>
  import('@/pages/admin/AdminArticlesPage').then((m) => ({ default: m.AdminArticlesPage })),
)
const AdminArticleEditorPage = lazyImport(() =>
  import('@/pages/admin/AdminArticlesPage').then((m) => ({ default: m.AdminArticleEditorPage })),
)
const AdminCertificationsPage = lazyImport(() =>
  import('@/pages/admin/AdminCertificationsPage').then((m) => ({
    default: m.AdminCertificationsPage,
  })),
)
const AdminCertificationEditorPage = lazyImport(() =>
  import('@/pages/admin/AdminCertificationsPage').then((m) => ({
    default: m.AdminCertificationEditorPage,
  })),
)
const AdminProvidersPage = lazyImport(() =>
  import('@/pages/admin/AdminCertificationsPage').then((m) => ({ default: m.AdminProvidersPage })),
)
const AdminUsersPage = lazyImport(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminUsersPage })),
)
const AdminEnrollmentsPage = lazyImport(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminEnrollmentsPage })),
)
const AdminExamBookingsPage = lazyImport(() => import('@/pages/admin/AdminExamBookingsPage'))
const AdminChallengePage = lazyImport(() => import('@/pages/admin/AdminChallengePage'))
const AdminPaymentsPage = lazyImport(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminPaymentsPage })),
)
const AdminMessagesPage = lazyImport(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminMessagesPage })),
)
const AdminFaqsPage = lazyImport(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminFaqsPage })),
)
const AdminTestimonialsPage = lazyImport(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminTestimonialsPage })),
)
const AdminCategoriesPage = lazyImport(() =>
  import('@/pages/admin/AdminOpsPages').then((m) => ({ default: m.AdminCategoriesPage })),
)
const AdminSettingsPage = lazyImport(() =>
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
          <Route path="schedule-exam" element={<ScheduleExamPage />} />
          <Route path="challenge" element={<ChallengePage />} />
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
          <Route path="verify-email" element={<VerifyEmailPage />} />
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
            <Route path="exam-bookings" element={<AdminExamBookingsPage />} />
            <Route path="challenge-leads" element={<AdminChallengePage />} />
            <Route path="payments" element={<AdminPaymentsPage />} />
            <Route path="messages" element={<AdminMessagesPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}
