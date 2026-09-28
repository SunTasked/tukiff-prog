import { useState } from 'react'
import { addMonths, formatDay, formatMonth, monthGrid, monthOf, today } from '../domain/dates'

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Month view (Monday first) to pick a "YYYY-MM-DD" date with one tap. */
export function MiniCalendar({
  value,
  onPick,
  min,
  max,
}: {
  value: string
  onPick: (iso: string) => void
  min?: string
  max?: string
}) {
  const [month, setMonth] = useState(monthOf(value || today()))
  const now = today()
  const allowed = (iso: string) => (!min || iso >= min) && (!max || iso <= max)
  const nav = 'size-9 rounded-full text-lg text-zinc-300 active:bg-zinc-800 disabled:opacity-30'

  return (
    <div className="w-full max-w-xs rounded-xl border border-zinc-800 bg-zinc-950 p-2 select-none">
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          className={nav}
          aria-label="Mois précédent"
          disabled={!!min && month <= min}
          onClick={() => setMonth(addMonths(month, -1))}
        >
          ‹
        </button>
        <span className="font-semibold capitalize">{formatMonth(month)}</span>
        <button
          type="button"
          className={nav}
          aria-label="Mois suivant"
          disabled={!!max && addMonths(month, 1) > max}
          onClick={() => setMonth(addMonths(month, 1))}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-zinc-500">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {monthGrid(month)
          .flat()
          .map((iso) => {
            const selected = iso === value
            const outside = iso.slice(0, 7) !== month.slice(0, 7)
            return (
              <button
                key={iso}
                type="button"
                disabled={!allowed(iso)}
                onClick={() => onPick(iso)}
                className={`mx-auto size-9 rounded-full text-sm tabular-nums disabled:opacity-25 ${
                  selected
                    ? 'bg-lime-400 font-bold text-zinc-950'
                    : `active:bg-zinc-800 ${iso === now ? 'font-bold text-lime-400 ring-1 ring-lime-400/60' : ''} ${outside ? 'text-zinc-600' : 'text-zinc-100'}`
                }`}
              >
                {Number(iso.slice(8))}
              </button>
            )
          })}
      </div>
      {allowed(now) && (
        <button
          type="button"
          className="mt-1 w-full rounded-lg py-1.5 text-sm text-lime-400 active:bg-zinc-800"
          onClick={() => onPick(now)}
        >
          Aujourd’hui
        </button>
      )}
    </div>
  )
}

const field = 'rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-zinc-100'

/** Button showing the date; tapping it unfolds a mini calendar below, picking a day folds it back. */
export function DateField({
  value,
  onChange,
  min,
  max,
  className = '',
}: {
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex w-full flex-col gap-2">
      <button type="button" className={`${field} ${open ? 'border-lime-400' : ''} ${className}`} onClick={() => setOpen(!open)}>
        📅 {value ? formatDay(value) : 'Choisir une date'}
      </button>
      {open && (
        <MiniCalendar
          value={value}
          min={min}
          max={max}
          onPick={(iso) => {
            onChange(iso)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

/** Date + time as a "YYYY-MM-DDTHH:MM" local value (same format as <input type="datetime-local">). */
export function DateTimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [date, time = '07:00'] = value ? value.split('T') : [today()]
  const [open, setOpen] = useState(false)
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" className={`${field} flex-1 ${open ? 'border-lime-400' : ''}`} onClick={() => setOpen(!open)}>
          📅 {formatDay(date)}
        </button>
        <input
          type="time"
          aria-label="Heure"
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 [color-scheme:dark]"
          value={time}
          onChange={(e) => e.target.value && onChange(`${date}T${e.target.value}`)}
        />
      </div>
      {open && (
        <MiniCalendar
          value={date}
          onPick={(iso) => {
            onChange(`${iso}T${time}`)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}
