/**
 * Minimal, dependency-free Markdown renderer for article and lesson bodies.
 *
 * Content comes from our own CMS and is rendered as React elements rather than
 * `dangerouslySetInnerHTML`, so no raw HTML from the database can execute.
 *
 * On top of plain Markdown it understands a small set of `:::` container
 * directives, which is how lesson content embeds practice questions, the
 * hint/solution pairs that coding exercises need, and the take-away worksheets
 * and checklists the practical modules hand out:
 *
 *     :::quiz
 *     Q. Which of these best describes a token?
 *     - A whole word, always
 *     + A chunk of text a model reads and writes
 *     = Models read tokens, not characters or whole words.
 *     :::
 *
 *     :::hint Start by naming the variable
 *     Any Markdown, including code fences.
 *     :::
 *
 *     :::solution
 *     Any Markdown, including code fences.
 *     :::
 *
 *     :::worksheet Buyer persona sheet
 *     Any Markdown. The learner can copy it or download it as a .txt file.
 *     :::
 *
 * Pipe tables render when a header row is followed by a `| --- | --- |`
 * separator, which is what the marking rubrics use.
 *
 * HTML comments are dropped, so `<!-- scaffold -->` style authoring notes never
 * reach the page. Inside a code fence they are content and survive, which is how
 * an HTML exercise can show `<!-- Your code here -->`.
 *
 * Inside a quiz, `-` is a wrong option, `+` or `*` is a correct one, and `=` is
 * the answer key. `worksheet`, `template` and `checklist` are the same block
 * with a different label. An unrecognised directive degrades to its body as
 * ordinary Markdown rather than disappearing.
 */

import { Fragment, type ReactNode } from 'react'

import { Disclosure, type DisclosureVariant } from '@/components/learn/Disclosure'
import { Quiz, type QuizQuestion } from '@/components/learn/Quiz'
import { Worksheet, type WorksheetVariant } from '@/components/learn/Worksheet'
import { slugifyHeading } from '@/lib/slug'

type Block =
  | { kind: 'heading'; level: 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; text: string; breaks?: boolean }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'rule' }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'quiz'; questions: QuizQuestion[] }
  | { kind: 'disclosure'; variant: DisclosureVariant; title?: string; blocks: Block[] }
  | {
      kind: 'worksheet'
      variant: WorksheetVariant
      title?: string
      /** Kept verbatim so copy and download hand over the source, not the render. */
      raw: string
      blocks: Block[]
    }

/** Parse the body of a `:::quiz` directive into questions. */
function parseQuiz(body: string): QuizQuestion[] {
  const questions: QuizQuestion[] = []
  let current: QuizQuestion | null = null
  // Which field a bare continuation line belongs to, so a long prompt or
  // explanation can be wrapped across several lines in the source.
  let continuation: 'prompt' | 'explanation' | null = null

  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (!line) {
      continuation = null
      continue
    }

    const prompt = /^Q[.:]\s*(.*)$/.exec(line)
    if (prompt) {
      current = { prompt: prompt[1] ?? '', options: [] }
      questions.push(current)
      continuation = 'prompt'
      continue
    }

    if (!current) continue

    const option = /^([-+*])\s+(.*)$/.exec(line)
    if (option) {
      current.options.push({ text: option[2] ?? '', correct: option[1] !== '-' })
      continuation = null
      continue
    }

    const answer = /^=\s*(.*)$/.exec(line)
    if (answer) {
      current.explanation = answer[1] ?? ''
      continuation = 'explanation'
      continue
    }

    if (continuation === 'prompt') {
      current.prompt = `${current.prompt} ${line}`.trim()
    } else if (continuation === 'explanation') {
      current.explanation = `${current.explanation ?? ''} ${line}`.trim()
    }
  }

  // A question with no options is an authoring mistake, not something to render.
  return questions.filter((question) => question.options.length > 0)
}

/**
 * `breaks` keeps single line breaks inside paragraphs, which worksheets and
 * templates need: a form is its layout, and joining its lines into prose
 * destroys it. Ordinary prose still wraps freely.
 */
function parse(markdown: string, breaks = false): Block[] {
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

    // An HTML comment is an authoring note, not content. Dropped here rather
    // than with a global regex so `<!-- Your code here -->` inside a fenced
    // starter-code block survives: the fence branch above has already consumed
    // it by the time we get here.
    if (line.trimStart().startsWith('<!--')) {
      while (index < lines.length && !(lines[index] ?? '').includes('-->')) {
        index += 1
      }
      index += 1
      continue
    }

    if (line.trimStart().startsWith(':::')) {
      const header = /^:::\s*([A-Za-z][\w-]*)?\s*(.*)$/.exec(line.trim())
      const name = (header?.[1] ?? '').toLowerCase()
      const title = (header?.[2] ?? '').trim()
      const buffer: string[] = []
      let inFence = false
      index += 1

      while (index < lines.length) {
        const candidate = lines[index] ?? ''
        // A closing ::: inside a code fence is content, not the terminator.
        if (candidate.startsWith('```')) inFence = !inFence
        if (!inFence && candidate.trim() === ':::') {
          index += 1
          break
        }
        buffer.push(candidate)
        index += 1
      }

      const body = buffer.join('\n')
      if (name === 'quiz') {
        blocks.push({ kind: 'quiz', questions: parseQuiz(body) })
      } else if (name === 'hint' || name === 'solution') {
        blocks.push({
          kind: 'disclosure',
          variant: name,
          title: title || undefined,
          blocks: parse(body),
        })
      } else if (name === 'worksheet' || name === 'template' || name === 'checklist') {
        blocks.push({
          kind: 'worksheet',
          variant: name,
          title: title || undefined,
          raw: body.trim(),
          blocks: parse(body, true),
        })
      } else {
        blocks.push(...parse(body, breaks))
      }
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

    // Pipe tables. A row is only a table when the line after it is the
    // `| --- | --- |` separator, so an ordinary sentence containing a pipe is
    // still a paragraph. The marking rubrics depend on this.
    const cells = (row: string) =>
      row
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim())

    if (line.trimStart().startsWith('|') && /^\s*\|[\s:|-]+\|?\s*$/.test(lines[index + 1] ?? '')) {
      const head = cells(line)
      index += 2
      const rows: string[][] = []
      while (index < lines.length && (lines[index] ?? '').trimStart().startsWith('|')) {
        rows.push(cells(lines[index] ?? ''))
        index += 1
      }
      blocks.push({ kind: 'table', head, rows })
      continue
    }

    const unordered = /^[-*]\s+/
    const ordered = /^\d+\.\s+/
    if (unordered.test(line) || ordered.test(line)) {
      const isOrdered = ordered.test(line)
      const pattern = isOrdered ? ordered : unordered
      const items: string[] = []
      while (index < lines.length && pattern.test(lines[index] ?? '')) {
        let item = (lines[index] ?? '').replace(pattern, '')
        index += 1
        // An indented line under an item is that item wrapping, not a new
        // paragraph. Only indented ones: an unindented line straight after a
        // list is a new paragraph, and hundreds of existing lessons rely on
        // that. An indented line that is itself a bullet is left alone, since
        // nested lists are not supported and silently swallowing one would be
        // worse than rendering it flat.
        while (index < lines.length) {
          const next = lines[index] ?? ''
          if (!/^\s+\S/.test(next)) break
          if (/^[-*]\s+/.test(next.trim()) || /^\d+\.\s+/.test(next.trim())) break
          item = `${item} ${next.trim()}`
          index += 1
        }
        items.push(item)
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
      !(lines[index] ?? '').trimStart().startsWith(':::') &&
      !(lines[index] ?? '').startsWith('> ') &&
      !(lines[index] ?? '').trimStart().startsWith('|') &&
      !unordered.test(lines[index] ?? '') &&
      !ordered.test(lines[index] ?? '')
    ) {
      buffer.push(lines[index] ?? '')
      index += 1
    }
    blocks.push({ kind: 'paragraph', text: buffer.join(breaks ? '\n' : ' '), breaks })
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

function renderBlocks(blocks: Block[], keyPrefix: string): ReactNode[] {
  return blocks.map((block, index) => {
    const key = `${keyPrefix}-${index}`
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
      case 'table':
        // Wrapped so a wide rubric scrolls inside its own box rather than
        // widening the page on a phone.
        return (
          <div key={key} className="scroll-x">
            <table>
              <thead>
                <tr>
                  {block.head.map((cell, position) => (
                    <th key={`${key}-h${position}`} scope="col">
                      {renderInline(cell, `${key}-h${position}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`${key}-r${rowIndex}`}>
                    {row.map((cell, position) => (
                      <td key={`${key}-r${rowIndex}c${position}`}>
                        {renderInline(cell, `${key}-r${rowIndex}c${position}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'quiz':
        return <Quiz key={key} questions={block.questions} />
      case 'disclosure':
        return (
          <Disclosure key={key} variant={block.variant} title={block.title}>
            {renderBlocks(block.blocks, key)}
          </Disclosure>
        )
      case 'worksheet':
        return (
          <Worksheet key={key} variant={block.variant} title={block.title} raw={block.raw}>
            {renderBlocks(block.blocks, key)}
          </Worksheet>
        )
      default: {
        // A paragraph only carries newlines when it came from a worksheet, so
        // the split is a no-op for ordinary prose.
        const paragraphLines = block.text.split('\n')
        return (
          <p key={key}>
            {paragraphLines.map((line, position) => (
              <Fragment key={`${key}-l${position}`}>
                {position > 0 && <br />}
                {renderInline(line, `${key}-l${position}`)}
              </Fragment>
            ))}
          </p>
        )
      }
    }
  })
}

export function Markdown({ content }: { content: string }) {
  return <div className="prose-content">{renderBlocks(parse(content), 'block')}</div>
}
