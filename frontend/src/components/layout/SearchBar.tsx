import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

export function SearchBar({
  defaultValue = '',
  placeholder = 'Search courses, certifications and guides',
  className,
  size = 'md',
  onSubmitQuery,
  autoFocus,
}: {
  defaultValue?: string
  placeholder?: string
  className?: string
  size?: 'md' | 'lg'
  onSubmitQuery?: (query: string) => void
  autoFocus?: boolean
}) {
  const [value, setValue] = useState(defaultValue)
  const navigate = useNavigate()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const query = value.trim()
    if (!query) return
    if (onSubmitQuery) {
      onSubmitQuery(query)
    } else {
      navigate(`/search?q=${encodeURIComponent(query)}`)
    }
  }

  return (
    <form role="search" onSubmit={handleSubmit} className={cn('flex w-full gap-2', className)}>
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          autoFocus={autoFocus}
          className={cn(
            'w-full rounded-lg border border-ink-300 bg-white pl-10 pr-3 text-sm text-ink-900 shadow-subtle transition placeholder:text-ink-400 hover:border-ink-400',
            size === 'lg' ? 'h-12' : 'h-11',
          )}
        />
      </div>
      <Button type="submit" size={size === 'lg' ? 'lg' : 'md'}>
        Search
      </Button>
    </form>
  )
}
