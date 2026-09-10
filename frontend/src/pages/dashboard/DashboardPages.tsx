import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Award,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Download,
  GraduationCap,
  Target,
  TrendingUp,
} from 'lucide-react'
import { z } from 'zod'

import { CertificationCard } from '@/components/cards/CertificationCard'
import { CourseCard } from '@/components/cards/CourseCard'
import { ResourceCard, StatsCard } from '@/components/cards/misc'
import { Button, ButtonLink } from '@/components/ui/Button'
import {
  Badge,
  Card,
  Field,
  Input,
  ProgressBar,
  Textarea,
} from '@/components/ui/primitives'
import { CardGridSkeleton, EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import {
  changePassword,
  getMyCertificates,
  getMyDashboard,
  getMyEnrollments,
  getMyProgress,
  getPracticeResources,
  getSavedCertifications,
  unsaveCertification,
  updateProfile,
} from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */
export function DashboardOverviewPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: getMyDashboard,
  })

  if (isError) return <ErrorState onRetry={() => void refetch()} />

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index} className="h-28 p-5" />
          ))}
        </div>
        <ListSkeleton rows={3} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          label="Courses enrolled"
          value={data.enrolled_courses}
          icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
          tone="brand"
        />
        <StatsCard
          label="Courses completed"
          value={data.completed_courses}
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
        />
        <StatsCard
          label="Lessons completed"
          value={data.total_lessons_completed}
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
        />
        <StatsCard
          label="Certificates earned"
          value={data.certificates_earned}
          icon={<Award className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <Card className="p-6">
        <h2 className="text-base font-bold text-ink-900">Overall progress</h2>
        <p className="mt-1 text-sm text-ink-600">
          Averaged across every course you are enrolled in.
        </p>
        <ProgressBar value={data.overall_progress} label="All courses" className="mt-5" />
      </Card>

      <section aria-labelledby="continue">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="continue" className="text-base font-bold text-ink-900">
            Continue learning
          </h2>
          <Link
            to="/dashboard/courses"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            All courses
          </Link>
        </div>

        {data.recent_courses.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-6 w-6" aria-hidden="true" />}
            title="No enrolled courses"
            description="Enroll in a course and it will appear here with your progress."
            action={<ButtonLink to="/courses">Browse courses</ButtonLink>}
          />
        ) : (
          <ul className="space-y-3">
            {data.recent_courses.map((course) => (
              <li key={course.course_id}>
                <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-ink-900">
                      {course.course_title}
                    </h3>
                    <p className="mt-1 text-xs text-ink-500">
                      {course.completed_lessons} of {course.total_lessons} lessons
                      {course.last_accessed_at
                        ? ` · last opened ${formatDate(course.last_accessed_at)}`
                        : ''}
                    </p>
                    <ProgressBar value={course.progress_percentage} size="sm" className="mt-3" />
                  </div>
                  <ButtonLink to={`/learn/${course.course_slug}`} size="sm" className="shrink-0">
                    {course.progress_percentage === 0 ? 'Start' : 'Continue'}
                  </ButtonLink>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* My courses                                                                 */
/* -------------------------------------------------------------------------- */
export function MyCoursesPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.enrollments,
    queryFn: getMyEnrollments,
  })

  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (isLoading) return <CardGridSkeleton count={3} />

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="h-6 w-6" aria-hidden="true" />}
        title="No enrolled courses"
        description="Courses you enroll in will appear here, with your progress saved automatically."
        action={<ButtonLink to="/courses">Browse courses</ButtonLink>}
      />
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((enrollment) =>
        enrollment.course ? (
          <div key={enrollment.id} className="flex flex-col gap-3">
            <CourseCard course={enrollment.course} />
            <Card className="p-4">
              <ProgressBar
                value={enrollment.progress_percentage}
                label={enrollment.status === 'completed' ? 'Completed' : 'Progress'}
                size="sm"
              />
              <ButtonLink
                to={`/learn/${enrollment.course.slug}`}
                size="sm"
                fullWidth
                className="mt-3"
              >
                {enrollment.progress_percentage === 0 ? 'Start course' : 'Continue'}
              </ButtonLink>
            </Card>
          </div>
        ) : null,
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */
export function ProgressPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.progress,
    queryFn: getMyProgress,
  })

  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (isLoading) return <ListSkeleton rows={4} />

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-6 w-6" aria-hidden="true" />}
        title="No progress yet"
        description="Once you start a course, your lesson-level progress appears here."
        action={<ButtonLink to="/courses">Find a course</ButtonLink>}
      />
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="scroll-x">
        <table className="w-full min-w-[38rem] text-sm">
          <thead className="border-b border-ink-200 bg-ink-50 text-left">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold text-ink-700">
                Course
              </th>
              <th scope="col" className="px-5 py-3 font-semibold text-ink-700">
                Lessons
              </th>
              <th scope="col" className="px-5 py-3 font-semibold text-ink-700">
                Progress
              </th>
              <th scope="col" className="px-5 py-3 font-semibold text-ink-700">
                Status
              </th>
              <th scope="col" className="px-5 py-3 text-right font-semibold text-ink-700">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200">
            {data.map((course) => (
              <tr key={course.course_id}>
                <td className="px-5 py-4 font-medium text-ink-900">{course.course_title}</td>
                <td className="px-5 py-4 text-ink-600">
                  {course.completed_lessons}/{course.total_lessons}
                </td>
                <td className="px-5 py-4">
                  <ProgressBar value={course.progress_percentage} size="sm" />
                </td>
                <td className="px-5 py-4">
                  <Badge tone={course.status === 'completed' ? 'success' : 'brand'}>
                    {course.status === 'completed' ? 'Completed' : 'In progress'}
                  </Badge>
                </td>
                <td className="px-5 py-4 text-right">
                  <ButtonLink to={`/learn/${course.course_slug}`} size="sm" variant="outline">
                    Open
                  </ButtonLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Saved certifications                                                       */
/* -------------------------------------------------------------------------- */
export function SavedCertificationsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.savedCertifications,
    queryFn: getSavedCertifications,
  })

  const remove = useMutation({
    mutationFn: (id: string) => unsaveCertification(id),
    onSuccess: () => {
      toast.success('Removed from your saved list.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.savedCertifications })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
    },
    onError: () => toast.error('We could not remove that certification.'),
  })

  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (isLoading) return <CardGridSkeleton count={3} />

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Bookmark className="h-6 w-6" aria-hidden="true" />}
        title="No saved certifications"
        description="Save a certification while browsing and it will be waiting here."
        action={<ButtonLink to="/certifications">Explore certifications</ButtonLink>}
      />
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((saved) => (
        <CertificationCard
          key={saved.id}
          certification={saved.certification}
          onToggleSave={(certification) => remove.mutate(certification.id)}
          saving={remove.isPending}
        />
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Practice                                                                   */
/* -------------------------------------------------------------------------- */
export function PracticePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.practiceResources,
    queryFn: getPracticeResources,
  })

  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (isLoading) return <CardGridSkeleton count={4} />

  return (
    <div className="space-y-6">
      <Card className="border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-900">About these practice resources</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          These are study aids built from published exam objectives. They are not real exam
          questions and are not supplied by the certification providers.
        </p>
      </Card>

      {!data || data.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" aria-hidden="true" />}
          title="No practice resources yet"
          description="Practice material is published alongside certification pages as it is written."
          action={<ButtonLink to="/certifications">Browse certifications</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Certificates                                                               */
/* -------------------------------------------------------------------------- */
export function CertificatesPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.certificates,
    queryFn: getMyCertificates,
  })

  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (isLoading) return <ListSkeleton rows={2} />

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Award className="h-6 w-6" aria-hidden="true" />}
        title="No certificates yet"
        description="Complete every lesson in a course to earn a completion certificate."
        action={<ButtonLink to="/dashboard/courses">Continue a course</ButtonLink>}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <p className="text-sm text-ink-600">
          These certificates record what you completed on this platform. They are{' '}
          <strong className="font-semibold text-ink-900">not</strong> vendor certifications, which
          are earned by passing the provider&rsquo;s own exam.
        </p>
      </Card>

      <ul className="grid gap-4 sm:grid-cols-2">
        {data.map((certificate) => (
          <li key={certificate.id}>
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <GraduationCap className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-ink-900">
                    {certificate.course?.title ?? 'Course'}
                  </h2>
                  <p className="mt-1 text-xs text-ink-500">
                    Issued {formatDate(certificate.issued_at)}
                  </p>
                  <p className="mt-2 font-mono text-xs text-ink-600">{certificate.serial}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-5"
                onClick={() => window.print()}
                leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
              >
                Save as PDF
              </Button>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */
const profileSchema = z.object({
  name: z.string().min(2, 'Please enter your name.').max(120),
  headline: z.string().max(160).optional(),
  bio: z.string().max(2000).optional(),
})

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Enter your current password.'),
  new_password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/\d/, 'Include at least one number.'),
})

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

export function ProfilePage() {
  const { user, setUser, logout } = useAuth()
  const toast = useToast()
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      headline: user?.headline ?? '',
      bio: user?.bio ?? '',
    },
  })

  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const saveProfile = useMutation({
    mutationFn: (values: ProfileForm) => updateProfile(values),
    onSuccess: (updated) => {
      setUser(updated)
      toast.success('Profile updated.')
    },
    onError: () => toast.error('We could not save your profile.'),
  })

  const savePassword = useMutation({
    mutationFn: (values: PasswordForm) => changePassword(values),
    onSuccess: async () => {
      toast.success('Password changed. Please sign in again.')
      passwordForm.reset()
      // Changing a password revokes every session, including this one.
      await logout()
    },
    onError: (error) => {
      setPasswordError(
        error instanceof ApiError ? error.message : 'We could not change your password.',
      )
    },
  })

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="text-base font-bold text-ink-900">Your profile</h2>
        <p className="mt-1 text-sm text-ink-600">
          Signed in as <span className="font-medium text-ink-800">{user?.email}</span>
        </p>

        <form
          noValidate
          onSubmit={profileForm.handleSubmit((values) => saveProfile.mutate(values))}
          className="mt-6 space-y-5"
        >
          <Field
            label="Full name"
            htmlFor="profile-name"
            required
            error={profileForm.formState.errors.name?.message}
          >
            <Input id="profile-name" {...profileForm.register('name')} />
          </Field>
          <Field
            label="Headline"
            htmlFor="profile-headline"
            hint="A short description shown alongside your reviews."
            error={profileForm.formState.errors.headline?.message}
          >
            <Input id="profile-headline" {...profileForm.register('headline')} />
          </Field>
          <Field label="Bio" htmlFor="profile-bio" error={profileForm.formState.errors.bio?.message}>
            <Textarea id="profile-bio" rows={4} {...profileForm.register('bio')} />
          </Field>
          <Button type="submit" loading={saveProfile.isPending}>
            Save changes
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-bold text-ink-900">Change password</h2>
        <p className="mt-1 text-sm text-ink-600">
          Changing your password signs you out of every device.
        </p>

        <form
          noValidate
          onSubmit={passwordForm.handleSubmit((values) => {
            setPasswordError(null)
            savePassword.mutate(values)
          })}
          className="mt-6 space-y-5"
        >
          {passwordError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-900"
            >
              {passwordError}
            </div>
          )}

          <Field
            label="Current password"
            htmlFor="current-password"
            required
            error={passwordForm.formState.errors.current_password?.message}
          >
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              {...passwordForm.register('current_password')}
            />
          </Field>
          <Field
            label="New password"
            htmlFor="new-password"
            required
            error={passwordForm.formState.errors.new_password?.message}
          >
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              {...passwordForm.register('new_password')}
            />
          </Field>
          <Button type="submit" variant="secondary" loading={savePassword.isPending}>
            Update password
          </Button>
        </form>
      </Card>
    </div>
  )
}
