import { useId, useState, type ReactNode } from 'react'
import { ClipboardList, Check, Copy, Download } from 'lucide-react'

import { Button } from '@/components/ui/Button'

export type WorksheetVariant = 'worksheet' | 'template' | 'checklist'

const VARIANTS: Record<WorksheetVariant, { label: string; noun: string }> = {
  worksheet: { label: 'Worksheet', noun: 'worksheet' },
  template: { label: 'Template', noun: 'template' },
  checklist: { label: 'Checklist', noun: 'checklist' },
}

/**
 * A worksheet, template or checklist the learner takes away and fills in.
 *
 * Practical modules hand out artefacts -- a persona sheet, an audit checklist,
 * an ad-copy grid -- and a learner needs them somewhere they can actually be
 * worked on. So this renders the body as ordinary lesson content and adds two
 * ways out: copy the raw text to the clipboard, or download it as a .txt file
 * that pastes cleanly into Docs, Sheets or Notion.
 *
 * Open by default, unlike `Disclosure`: there is nothing to spoil here, and a
 * worksheet the learner has to go looking for is a worksheet they skip.
 *
 * The download is built from a Blob in the browser. Nothing is uploaded, so
 * this works for an anonymous reader on a preview lesson as well as an
 * enrolled one.
 */
export function Worksheet({
  variant,
  title,
  raw,
  children,
}: {
  variant: WorksheetVariant
  title?: string
  /** The verbatim directive body, used for copy and download. */
  raw: string
  children: ReactNode
}) {
  const baseId = useId()
  const [copied, setCopied] = useState(false)
  const { label, noun } = VARIANTS[variant]
  const heading = title ?? label

  async function copy() {
    try {
      await navigator.clipboard.writeText(raw)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* Clipboard unavailable, the text is on the page to select by hand. */
    }
  }

  function download() {
    // Slug from the heading so a learner who downloads six worksheets can tell
    // them apart in their downloads folder.
    const name =
      heading
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || noun

    const blob = new Blob([`${heading}\n\n${raw}\n`], {
      type: 'text/plain;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${name}.txt`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section
      aria-labelledby={`${baseId}-heading`}
      className="my-8 overflow-hidden rounded-xl border border-brand-200 bg-brand-50/40"
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-3 border-b border-brand-200 px-4 py-3">
        <ClipboardList className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
        <h3 id={`${baseId}-heading`} className="flex-1 text-sm font-bold text-brand-900">
          {heading}
        </h3>
        <span className="text-xs font-medium uppercase tracking-wider text-brand-700/70">
          {label}
        </span>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={copy}
            leadingIcon={
              copied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )
            }
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={download}
            leadingIcon={<Download className="h-4 w-4" aria-hidden="true" />}
          >
            Download
          </Button>
        </div>
        {/* Announced on copy, since the button label change alone is easy to
            miss with a screen reader. */}
        <span role="status" className="sr-only">
          {copied ? `${heading} copied to the clipboard` : ''}
        </span>
      </div>

      <div className="bg-white/70 px-4 py-4">{children}</div>
    </section>
  )
}
