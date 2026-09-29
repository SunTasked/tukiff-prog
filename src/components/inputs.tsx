import { useEffect, useState } from 'react'
import { durationParts, formatNumber, parseDuration, parseNumber } from '../domain/workout'
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

const selectClass = {
  sm: 'rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2',
  lg: 'rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-lg',
}

/** Duration as two native selects (minutes / seconds): iOS shows them as scroll wheels. */
export function DurationPicker({
  value,
  onChange,
  maxMinutes = 99,
  size = 'sm',
}: {
  value: number | null | undefined
  onChange: (v: number | null) => void
  maxMinutes?: number
  size?: 'sm' | 'lg'
}) {
  const minutes = value == null ? '' : String(Math.floor(value / 60))
  const seconds = value == null ? '' : String(value % 60)
  const cls = `min-w-0 flex-1 text-zinc-100 outline-none focus:border-lime-400 ${selectClass[size]}`

  return (
    <div className="flex items-center gap-1">
      <select
        aria-label="Minutes"
        className={cls}
        value={minutes}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value) * 60 + (value ?? 0) % 60)}
      >
        <option value="">min</option>
        {Array.from({ length: maxMinutes + 1 }, (_, m) => (
          <option key={m} value={m}>
            {m} min
          </option>
        ))}
      </select>
      <select
        aria-label="Secondes"
        className={cls}
        value={seconds}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : Math.floor((value ?? 0) / 60) * 60 + Number(e.target.value))
        }
      >
        <option value="">s</option>
        {Array.from({ length: 60 }, (_, s) => (
          <option key={s} value={s}>
            {String(s).padStart(2, '0')} s
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * Time score typed on the keypad: minutes, then seconds with an optional tenth ("32,4").
 * Emits null while empty or unreadable, so the sheet's validation asks for a time.
 */
export function DurationInput({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  const [parts, setParts] = useState<[string, string]>(() => (value != null ? durationParts(value) : ['', '']))
  useEffect(() => {
    if ((value ?? null) !== (parseDuration(...parts) ?? null)) setParts(value != null ? durationParts(value) : ['', ''])
  }, [value])
  const invalid = parseDuration(...parts) === undefined

  function update(next: [string, string]) {
    setParts(next)
    onChange(parseDuration(...next) ?? null)
  }

  const cls = `w-0 min-w-0 flex-1 rounded-xl border bg-zinc-900 px-4 py-3 text-center text-lg text-zinc-100 outline-none focus:border-lime-400 ${invalid ? 'border-red-500' : 'border-zinc-800'}`
  return (
    <div className="flex items-center gap-2">
      <input
        aria-label="Minutes"
        className={cls}
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="0"
        maxLength={3}
        value={parts[0]}
        onChange={(e) => update([e.target.value, parts[1]])}
      />
      <span className="text-zinc-400">min</span>
      <input
        aria-label="Secondes"
        className={cls}
        inputMode="decimal"
        placeholder="00,0"
        maxLength={4}
        value={parts[1]}
        onChange={(e) => update([parts[0], e.target.value])}
      />
      <span className="text-zinc-400">s</span>
    </div>
  )
}
