import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'

import { AdminPageHeader, DataTable, type Column } from '@/components/admin/DataTable'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge, Input } from '@/components/ui/primitives'
import { deleteCourse, getAdminCourses, publishCourse } from '@/api/endpoints'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/useToast'
import { formatDuration, formatPrice } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import type { CourseCard } from '@/types/api'

export default function AdminCoursesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<CourseCard | null>(null)
  const debounced = useDebounce(search)
  const queryClient = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()

  const query = { page, q: debounced || undefined }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminCourses(query),
    queryFn: () => getAdminCourses(query),
    placeholderData: keepPreviousData,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] })
    void queryClient.invalidateQueries({ queryKey: ['courses'] })
  }

  const togglePublish = useMutation({
    mutationFn: (course: CourseCard) => publishCourse(course.id, !course.is_published),
    onSuccess: (_result, course) => {
      toast.success(course.is_published ? 'Course unpublished.' : 'Course published.')
      invalidate()
    },
    onError: () => toast.error('Add at least one module before publishing.'),
  })

  const removeCourse = useMutation({
    mutationFn: (id: string) => deleteCourse(id),
    onSuccess: () => {
      toast.success('Course deleted.')
      setPendingDelete(null)
      invalidate()
    },
    onError: () => toast.error('We could not delete that course.'),
  })

  const columns: Column<CourseCard>[] = [
    {
      key: 'title',
      header: 'Course',
      render: (course) => (
        <div className="min-w-0">
          <Link
            to={`/admin/courses/${course.id}`}
            className="block truncate font-semibold text-ink-900 hover:text-brand-700"
          >
            {course.title}
          </Link>
          <span className="text-xs text-ink-500">/{course.slug}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (course) => course.category?.name ?? <span className="text-ink-400">None</span>,
    },
    { key: 'level', header: 'Level', render: (course) => course.level },
    {
      key: 'lessons',
      header: 'Lessons',
      align: 'right',
      render: (course) => course.lesson_count,
    },
    {
      key: 'duration',
      header: 'Duration',
      align: 'right',
      render: (course) => formatDuration(course.duration_minutes),
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      render: (course) => formatPrice(course.price, course.currency),
    },
    {
      key: 'status',
      header: 'Status',
      render: (course) => (
        <Badge tone={course.is_published ? 'success' : 'neutral'}>
          {course.is_published ? 'Published' : 'Draft'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (course) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/courses/${course.id}`)}
            aria-label={`Edit ${course.title}`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => togglePublish.mutate(course)}
            aria-label={course.is_published ? `Unpublish ${course.title}` : `Publish ${course.title}`}
          >
            {course.is_published ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPendingDelete(course)}
            aria-label={`Delete ${course.title}`}
            className="text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Courses"
        description="Create, organise and publish course content."
        actions={
          <ButtonLink
            to="/admin/courses/new"
            leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            New course
          </ButtonLink>
        }
      />

      <div className="mb-4 max-w-sm">
        <Input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Search courses"
          aria-label="Search courses"
        />
      </div>

      <DataTable
        caption="Courses"
        columns={columns}
        rows={data?.items}
        rowKey={(course) => course.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No courses yet"
        emptyDescription="Create your first course to get started."
        emptyAction={<ButtonLink to="/admin/courses/new">New course</ButtonLink>}
        page={data?.page}
        totalPages={data?.total_pages}
        onPageChange={setPage}
      />

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this course?"
        description="This removes the course, its modules, lessons and enrollments. It cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={removeCourse.isPending}
              onClick={() => pendingDelete && removeCourse.mutate(pendingDelete.id)}
            >
              Delete course
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          You are about to delete{' '}
          <strong className="font-semibold text-ink-900">{pendingDelete?.title}</strong>.
        </p>
      </Modal>
    </>
  )
}
