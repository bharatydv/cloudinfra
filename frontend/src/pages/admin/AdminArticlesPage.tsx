import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { z } from 'zod'

import { AdminPageHeader, DataTable, type Column } from '@/components/admin/DataTable'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge, Card, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import { DetailSkeleton, ErrorState } from '@/components/ui/states'
import {
  createArticle,
  deleteArticle,
  getAdminArticle,
  getAdminArticles,
  getArticleCategories,
  updateArticle,
} from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/useToast'
import { Markdown } from '@/lib/markdown'
import { formatDate } from '@/lib/format'
import { queryKeys } from '@/lib/queryClient'
import type { ArticleCard } from '@/types/api'

/* -------------------------------------------------------------------------- */
/* Listing                                                                    */
/* -------------------------------------------------------------------------- */
export function AdminArticlesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [pendingDelete, setPendingDelete] = useState<ArticleCard | null>(null)
  const debounced = useDebounce(search)
  const queryClient = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()

  const query = { page, q: debounced || undefined, status: status || undefined }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminArticles(query),
    queryFn: () => getAdminArticles(query),
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteArticle(id),
    onSuccess: () => {
      toast.success('Article deleted.')
      setPendingDelete(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'articles'] })
      void queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
    onError: () => toast.error('We could not delete that article.'),
  })

  const columns: Column<ArticleCard>[] = [
    {
      key: 'title',
      header: 'Article',
      render: (article) => (
        <div className="min-w-0">
          <Link
            to={`/admin/articles/${article.id}`}
            className="block truncate font-semibold text-ink-900 hover:text-brand-700"
          >
            {article.title}
          </Link>
          <span className="text-xs text-ink-500">/{article.slug}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (article) => article.category?.name ?? <span className="text-ink-400">None</span>,
    },
    {
      key: 'author',
      header: 'Author',
      render: (article) => article.author?.name ?? '-',
    },
    {
      key: 'published',
      header: 'Published',
      render: (article) =>
        article.published_at ? (
          formatDate(article.published_at)
        ) : (
          <Badge tone="neutral">Draft</Badge>
        ),
    },
    {
      key: 'reading',
      header: 'Read time',
      align: 'right',
      render: (article) => `${article.reading_minutes} min`,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (article) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/articles/${article.id}`)}
            aria-label={`Edit ${article.title}`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          {article.published_at && (
            <ButtonLink
              to={`/resources/${article.slug}`}
              variant="ghost"
              size="sm"
              aria-label={`View ${article.title}`}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-600 hover:bg-rose-50"
            onClick={() => setPendingDelete(article)}
            aria-label={`Delete ${article.title}`}
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
        title="Articles"
        description="Write and publish resource-hub content without touching code."
        actions={
          <ButtonLink
            to="/admin/articles/new"
            leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            New article
          </ButtonLink>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="max-w-sm flex-1">
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search articles"
            aria-label="Search articles"
          />
        </div>
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          aria-label="Filter by status"
          className="max-w-[12rem]"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="scheduled">Scheduled</option>
          <option value="archived">Archived</option>
        </Select>
      </div>

      <DataTable
        caption="Articles"
        columns={columns}
        rows={data?.items}
        rowKey={(article) => article.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        emptyTitle="No articles yet"
        emptyDescription="Publish your first guide or roadmap."
        emptyAction={<ButtonLink to="/admin/articles/new">New article</ButtonLink>}
        page={data?.page}
        totalPages={data?.total_pages}
        onPageChange={setPage}
      />

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this article?"
        description="This cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
            >
              Delete article
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

/* -------------------------------------------------------------------------- */
/* Editor                                                                     */
/* -------------------------------------------------------------------------- */
const articleSchema = z.object({
  title: z.string().min(3, 'Give the article a title.').max(220),
  slug: z.string().max(240).optional(),
  excerpt: z.string().max(400).optional(),
  content: z.string().min(1, 'Write some content.'),
  category_id: z.string().optional(),
  tag_names: z.string().optional(),
  featured_image: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  status: z.enum(['draft', 'scheduled', 'published', 'archived']),
  is_featured: z.boolean().optional(),
  meta_title: z.string().max(200).optional(),
  meta_description: z.string().max(320).optional(),
  canonical_url: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
})

type ArticleForm = z.infer<typeof articleSchema>

export function AdminArticleEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [preview, setPreview] = useState(false)

  const { data: categories } = useQuery({
    queryKey: queryKeys.articleCategories,
    queryFn: getArticleCategories,
  })
  const { data: article, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.adminArticle(id ?? ''),
    queryFn: () => getAdminArticle(id!),
    enabled: !isNew,
  })

  const form = useForm<ArticleForm>({
    resolver: zodResolver(articleSchema),
    defaultValues: { status: 'draft', content: '' },
  })

  useEffect(() => {
    if (!article) return
    form.reset({
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.content,
      category_id: article.category?.id ?? '',
      tag_names: article.tags.map((tag) => tag.name).join(', '),
      featured_image: article.featured_image ?? '',
      status: article.status,
      is_featured: article.is_featured,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article])

  const content = form.watch('content') ?? ''

  const save = useMutation({
    mutationFn: (values: ArticleForm) => {
      const payload = {
        title: values.title,
        slug: values.slug || undefined,
        excerpt: values.excerpt ?? '',
        content: values.content,
        category_id: values.category_id || null,
        tag_names: (values.tag_names ?? '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        featured_image: values.featured_image || null,
        status: values.status,
        is_featured: values.is_featured ?? false,
        meta_title: values.meta_title || null,
        meta_description: values.meta_description || null,
        canonical_url: values.canonical_url || null,
      }
      return isNew ? createArticle(payload) : updateArticle(id!, payload)
    },
    onSuccess: (saved) => {
      toast.success(isNew ? 'Article created.' : 'Article saved.')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'articles'] })
      void queryClient.invalidateQueries({ queryKey: ['articles'] })
      if (isNew) navigate(`/admin/articles/${saved.id}`, { replace: true })
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'We could not save the article.'),
  })

  if (!isNew && isLoading) return <DetailSkeleton />
  if (!isNew && isError) return <ErrorState onRetry={() => void refetch()} />

  return (
    <>
      <AdminPageHeader
        title={isNew ? 'New article' : (article?.title ?? 'Edit article')}
        description="Content is stored in the database and rendered as Markdown."
        actions={
          <>
            <Button variant="outline" onClick={() => setPreview((current) => !current)}>
              {preview ? 'Hide preview' : 'Preview'}
            </Button>
            <ButtonLink
              to="/admin/articles"
              variant="outline"
              leadingIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
            >
              Back
            </ButtonLink>
          </>
        }
      />

      <form
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="grid gap-6 xl:grid-cols-[1.6fr_1fr]"
      >
        <div className="space-y-6">
          <Card className="p-6">
            <div className="space-y-5">
              <Field
                label="Title"
                htmlFor="article-title"
                required
                error={form.formState.errors.title?.message}
              >
                <Input id="article-title" {...form.register('title')} />
              </Field>
              <Field
                label="Slug"
                htmlFor="article-slug"
                hint="Leave blank to generate from the title."
              >
                <Input id="article-slug" {...form.register('slug')} />
              </Field>
              <Field
                label="Excerpt"
                htmlFor="article-excerpt"
                hint="Leave blank to derive from the content."
              >
                <Textarea id="article-excerpt" rows={3} {...form.register('excerpt')} />
              </Field>
              <Field
                label="Content (Markdown)"
                htmlFor="article-content"
                required
                error={form.formState.errors.content?.message}
              >
                <Textarea
                  id="article-content"
                  rows={20}
                  className="font-mono text-sm"
                  {...form.register('content')}
                />
              </Field>
            </div>
          </Card>

          {preview && (
            <Card className="p-6">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-ink-500">
                Preview
              </h2>
              <Markdown content={content} />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-base font-bold text-ink-900">Publishing</h2>
            <div className="mt-5 space-y-5">
              <Field label="Status" htmlFor="article-status">
                <Select id="article-status" {...form.register('status')}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>
              <Field label="Category" htmlFor="article-category">
                <Select id="article-category" {...form.register('category_id')}>
                  <option value="">No category</option>
                  {categories?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tags" htmlFor="article-tags" hint="Comma separated.">
                <Input id="article-tags" {...form.register('tag_names')} />
              </Field>
              <Field
                label="Featured image URL"
                htmlFor="article-image"
                error={form.formState.errors.featured_image?.message}
              >
                <Input id="article-image" {...form.register('featured_image')} />
              </Field>
              <label className="flex items-center gap-2.5 text-sm text-ink-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 text-brand-600"
                  {...form.register('is_featured')}
                />
                Feature on the resources page
              </label>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-bold text-ink-900">SEO</h2>
            <div className="mt-5 space-y-5">
              <Field label="SEO title" htmlFor="article-meta-title">
                <Input id="article-meta-title" {...form.register('meta_title')} />
              </Field>
              <Field label="Meta description" htmlFor="article-meta-description">
                <Textarea
                  id="article-meta-description"
                  rows={3}
                  {...form.register('meta_description')}
                />
              </Field>
              <Field
                label="Canonical URL"
                htmlFor="article-canonical"
                hint="Only set this when the content is published elsewhere first."
                error={form.formState.errors.canonical_url?.message}
              >
                <Input id="article-canonical" {...form.register('canonical_url')} />
              </Field>
            </div>
          </Card>

          <Button type="submit" size="lg" fullWidth loading={save.isPending}>
            {isNew ? 'Create article' : 'Save article'}
          </Button>
        </div>
      </form>
    </>
  )
}
