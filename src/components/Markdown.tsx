import type { ReactNode } from 'react'

// Small markdown subset for coach text: # headings, - / 1. lists, **bold**, *italic*, blank line = paragraph.
// Builds React elements (no HTML injection).

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const bold = m[1] ?? m[2]
    out.push(
      bold !== undefined ? (
        <strong key={m.index} className="font-semibold text-zinc-100">
          {inline(bold)}
        </strong>
      ) : (
        <em key={m.index}>{inline(m[3] ?? m[4])}</em>
      ),
    )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

type Chunk =
  | { type: 'h'; level: number; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'p'; lines: string[] }

function chunks(src: string): Chunk[] {
  const out: Chunk[] = []
  for (const raw of src.split('\n')) {
    const line = raw.trimEnd()
    const last = out.at(-1)
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line)
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const list = ul ? 'ul' : ol ? 'ol' : null
    if (!line.trim()) out.push({ type: 'p', lines: [] })
    else if (h) out.push({ type: 'h', level: h[1].length, text: h[2] })
    else if (list && last?.type === list) last.items.push((ul ?? ol)![1])
    else if (list) out.push({ type: list, items: [(ul ?? ol)![1]] })
    else if (last?.type === 'p') last.lines.push(line)
    else out.push({ type: 'p', lines: [line] })
  }
  return out.filter((c) => c.type !== 'p' || c.lines.length)
}

export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {chunks(text).map((c, i) => {
        if (c.type === 'h')
          return (
            <p key={i} className={`font-bold text-zinc-100 ${c.level === 1 ? 'text-base' : ''}`}>
              {inline(c.text)}
            </p>
          )
        if (c.type !== 'p') {
          const List = c.type
          return (
            <List key={i} className={`flex flex-col gap-0.5 pl-5 ${c.type === 'ul' ? 'list-disc' : 'list-decimal'}`}>
              {c.items.map((it, j) => (
                <li key={j}>{inline(it)}</li>
              ))}
            </List>
          )
        }
        return (
          <p key={i}>
            {c.lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
