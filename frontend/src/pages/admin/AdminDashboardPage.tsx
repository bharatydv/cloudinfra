import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Award, BookOpen, DollarSign, FileText, Mail, Users } from 'lucide-react'

import { AdminPageHeader } from '@/components/admin/DataTable'
import { StatsCard } from '@/components/cards/misc'
import { Badge, Card } from '@/components/ui/primitives'
import { ErrorState, ListSkeleton } from '@/components/ui/states'
import { getAdminDashboard } from '@/api/endpoints'
import { formatDate, formatPrice } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'

export default function AdminDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminDashboard,
    queryFn: getAdminDashboard,
  })

  if (isError) return <ErrorState onRetry={() => void refetch()} />

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description="Platform activity at a glance."
      />

      {isLoading || !data ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatsCard
              label="Total users"
              value={data.stats.users}
              hint={`${data.stats.students} students`}
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
              tone="brand"
            />
            <StatsCard
              label="Courses"
              value={data.stats.courses}
              hint={`${data.stats.published_courses} published`}
              icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
            />
            <StatsCard
              label="Certifications"
              value={data.stats.certifications}
              icon={<Award className="h-4 w-4" aria-hidden="true" />}
            />
            <StatsCard
              label="Articles"
              value={data.stats.articles}
              hint={`${data.stats.published_articles} published`}
              icon={<FileText className="h-4 w-4" aria-hidden="true" />}
            />
            <StatsCard
              label="Enrollments"
              value={data.stats.enrollments}
              hint={`${data.stats.active_enrollments} active`}
              icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
            />
            <StatsCard
              label="Revenue"
              value={formatPrice(data.stats.revenue_total, data.stats.revenue_currency)}
              hint="Confirmed payments only"
              icon={<DollarSign className="h-4 w-4" aria-hidden="true" />}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">
                Recent users
              </h2>
              <ul className="mt-4 divide-y divide-ink-200">
                {data.recent_users.length === 0 && (
                  <li className="py-3 text-sm text-ink-500">No users yet.</li>
                )}
                {data.recent_users.map((user) => (
                  <li key={user.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{user.name}</p>
                      <p className="truncate text-xs text-ink-500">{user.email}</p>
                    </div>
                    <Badge tone={user.role === 'admin' ? 'brand' : 'neutral'}>{user.role}</Badge>
                  </li>
                ))}
              </ul>
              <Link
                to="/admin/users"
                className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline"
              >
                Manage users
              </Link>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">
                Recent enrollments
              </h2>
              <ul className="mt-4 divide-y divide-ink-200">
                {data.recent_enrollments.length === 0 && (
                  <li className="py-3 text-sm text-ink-500">No enrollments yet.</li>
                )}
                {data.recent_enrollments.map((enrollment) => (
                  <li key={enrollment.id} className="py-3">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {enrollment.course_title}
                    </p>
                    <p className="text-xs text-ink-500">
                      {enrollment.user_name} &middot; {formatDate(enrollment.enrolled_at)}
                    </p>
                  </li>
                ))}
              </ul>
              <Link
                to="/admin/enrollments"
                className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline"
              >
                View enrollments
              </Link>
            </Card>

            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
                <Mail className="h-4 w-4" aria-hidden="true" />
                Recent messages
                {data.stats.new_contact_messages > 0 && (
                  <Badge tone="warning">{data.stats.new_contact_messages} new</Badge>
                )}
              </h2>
              <ul className="mt-4 divide-y divide-ink-200">
                {data.recent_messages.length === 0 && (
                  <li className="py-3 text-sm text-ink-500">No messages yet.</li>
                )}
                {data.recent_messages.map((message) => (
                  <li key={message.id} className="py-3">
                    <p className="truncate text-sm font-medium text-ink-900">{message.subject}</p>
                    <p className="truncate text-xs text-ink-500">
                      {message.name} &middot; {formatDate(message.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
              <Link
                to="/admin/messages"
                className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline"
              >
                Open inbox
              </Link>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}
