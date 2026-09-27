// Calendar dates as "YYYY-MM-DD" strings (local time of the device, i.e. Europe/Paris for our users).

const pad = (n: number) => String(n).padStart(2, '0')

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Parses "YYYY-MM-DD" as a local date at noon (avoids DST edge cases). */
export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** Monday of the week containing the date. */
export function mondayOf(iso: string): string {
  const d = fromISODate(iso)
  return addDays(iso, -((d.getDay() + 6) % 7))
}

export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i))

export const today = () => toISODate(new Date())

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const longFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const timeFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const formatDay = (iso: string) => dayFmt.format(fromISODate(iso))
export const formatLongDay = (iso: string) => longFmt.format(fromISODate(iso))
export const formatDateTime = (ts: string) => timeFmt.format(new Date(ts))

export function formatWeek(monday: string): string {
  const f = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
  return `${f.format(fromISODate(monday))} – ${f.format(fromISODate(addDays(monday, 6)))}`
}

/** Value for <input type="datetime-local"> from an ISO timestamp, and back. */
export function toLocalInput(ts: string): string {
  const d = new Date(ts)
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fromLocalInput = (v: string) => new Date(v).toISOString()

export type PublicationStatus = 'draft' | 'scheduled' | 'published'
export function publicationStatus(publishAt: string | null, now = new Date()): PublicationStatus {
  if (!publishAt) return 'draft'
  return new Date(publishAt) <= now ? 'published' : 'scheduled'
}
