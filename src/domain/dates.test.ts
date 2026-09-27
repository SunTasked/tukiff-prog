import { describe, expect, it } from 'vitest'
import { addDays, fromLocalInput, mondayOf, publicationStatus, toLocalInput, weekDays } from './dates'

describe('weeks', () => {
  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-09-27')).toBe('2026-09-21') // Sunday
    expect(mondayOf('2026-09-21')).toBe('2026-09-21') // Monday
    expect(mondayOf('2026-10-01')).toBe('2026-09-28') // Thursday
  })
  it('crosses months, years and DST', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26') // DST ends Oct 25 in Paris
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(mondayOf('2026-01-01')).toBe('2025-12-29')
  })
  it('lists the 7 days', () => {
    expect(weekDays('2026-09-28')).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ])
  })
})

it('round-trips datetime-local values', () => {
  expect(toLocalInput(fromLocalInput('2026-09-28T07:00'))).toBe('2026-09-28T07:00')
})

it('computes publication status', () => {
  const now = new Date('2026-09-28T08:00:00Z')
  expect(publicationStatus(null, now)).toBe('draft')
  expect(publicationStatus('2026-09-28T07:00:00Z', now)).toBe('published')
  expect(publicationStatus('2026-09-29T07:00:00Z', now)).toBe('scheduled')
})
