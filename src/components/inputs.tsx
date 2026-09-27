import { useEffect, useState } from 'react'
import { formatDuration, formatNumber, parseDuration, parseNumber } from '../domain/workout'
import { SmallInput } from './ui'

/**
 * Text field bound to a parsed value. Commits on every keystroke (iOS does not always blur inputs
 * when tapping a button), keeps the raw text while it still parses to the same value.
 */
function ParsedInput({
  value,
  onChange,
  parse,
  format,
  ...props
}: {
  value: number | null | undefined
  onChange: (v: number | null) => void
  parse: (s: string) => number | null
  format: (n: number) => string
  placeholder?: string
  inputMode?: 'decimal' | 'numeric'
}) {
  const [text, setText] = useState(value != null ? format(value) : '')
  useEffect(() => {
    if ((value ?? null) !== parse(text)) setText(value != null ? format(value) : '')
  }, [value])

  return (
    <SmallInput
      {...props}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const v = parse(e.target.value)
        if (v !== null || !e.target.value.trim()) onChange(v)
      }}
      onBlur={() => setText(value != null ? format(value) : '')}
    />
  )
}

/** Number field accepting "42,5". */
export function NumberInput(props: { value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string }) {
  return <ParsedInput {...props} parse={parseNumber} format={formatNumber} inputMode="decimal" />
}

/** Duration field: "12" = 12 min, "1:30" / "1,30" = 1 min 30 s. */
export function DurationInput(props: { value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string }) {
  return <ParsedInput placeholder="mm:ss" {...props} parse={parseDuration} format={formatDuration} inputMode="decimal" />
}
