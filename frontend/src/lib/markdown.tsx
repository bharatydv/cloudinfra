/**
 * Minimal, dependency-free Markdown renderer for article and lesson bodies.
 *
 * Content comes from our own CMS and is rendered as React elements rather than
 * `dangerouslySetInnerHTML`, so no raw HTML from the database can execute.
 */

import { Fragment, type ReactNode } from 'react'

import { slugifyHeading } from '@/lib/slug'

type Block =
  | { kind: 'heading'; level: 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'rule' }

function parse(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''

    if (!line.trim()) {
      index += 1
      continue
    }

    if (line.startsWith('```')) {
      const buffer: string[] = []
      index += 1
      while (index < lines.length && !(lines[index] ?? '').startsWith('```')) {
        buffer.push(lines[index] ?? '')
        index += 1
      }
      index += 1
      blocks.push({ kind: 'code', text: buffer.join('\n') })
      continue
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push({ kind: 'rule' })
      index += 1
      continue
    }

    const heading = /^(#{2,4})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1]!.length as 2 | 3 | 4,
        text: heading[2]!.trim(),
      })
      index += 1
      continue
    }

    if (line.startsWith('> ')) {
      const buffer: string[] = []
      while (index < lines.length && (lines[index] ?? '').startsWith('> ')) {
        buffer.push((lines[index] ?? '').slice(2))
        index += 1
      }
      blocks.push({ kind: 'quote', text: buffer.join(' ') })
      continue
    }

    const unordered = /^[-*]\s+/
    const ordered = /^\d+\.\s+/
    if (unordered.test(line) || ordered.test(line)) {
      const isOrdered = ordered.test(line)
      const pattern = isOrdered ? ordered : unordered
      const items: string[] = []
      while (index < lines.length && pattern.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(pattern, ''))
        index += 1
      }
      blocks.push({ kind: 'list', ordered: isOrdered, items })
      continue
    }

    const buffer: string[] = []
    while (
      index < lines.length &&
      (lines[index] ?? '').trim() &&
      !/^(#{2,4})\s+/.test(lines[index] ?? '') &&
      !(lines[index] ?? '').startsWith('```') &&
      !(lines[index] ?? '').startsWith('> ') &&
      !unordered.test(lines[index] ?? '') &&
      !ordered.test(lines[index] ?? '')
    ) {
      buffer.push(lines[index] ?? '')
      index += 1
    }
    blocks.push({ kind: 'paragraph', text: buffer.join(' ') })
  }

  return blocks
}

/** Inline formatting: bold, italic, inline code and links. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  const parts = text.split(pattern).filter(Boolean)

  return parts.map((part, position) => {
    const key = `${keyPrefix}-${position}`
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={key}>{part.slice(1, -1)}</em>
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (link) {
      const href = link[2]!
      const external = /^https?:\/\//.test(href)
      return (
        <a
          key={key}
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {link[1]}
        </a>
      )
    }
    return <Fragment key={key}>{part}</Fragment>
  })
}

export function Markdown({ content }: { content: string }) {
  const blocks = parse(content)

  return (
    <div className="prose-content">
      {blocks.map((block, index) => {
        const key = `block-${index}`
        switch (block.kind) {
          case 'heading': {
            const id = slugifyHeading(block.text)
            const inner = renderInline(block.text, key)
            if (block.level === 2) return <h2 key={key} id={id}>{inner}</h2>
            if (block.level === 3) return <h3 key={key} id={id}>{inner}</h3>
            return <h4 key={key} id={id}>{inner}</h4>
          }
          case 'list':
            return block.ordered ? (
              <ol key={key}>
                {block.items.map((item, position) => (
                  <li key={`${key}-${position}`}>{renderInline(item, `${key}-${position}`)}</li>
                ))}
              </ol>
            ) : (
              <ul key={key}>
                {block.items.map((item, position) => (
                  <li key={`${key}-${position}`}>{renderInline(item, `${key}-${position}`)}</li>
                ))}
              </ul>
            )
          case 'code':
            return (
              <pre key={key}>
                <code>{block.text}</code>
              </pre>
            )
          case 'quote':
            return <blockquote key={key}>{renderInline(block.text, key)}</blockquote>
          case 'rule':
            return <hr key={key} />
          default:
            return <p key={key}>{renderInline(block.text, key)}</p>
        }
      })}
    </div>
  )
}
