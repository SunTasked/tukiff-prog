import { describe, expect, it } from 'vitest'
import { addDays, seenAgo, coversDay, lastDay, addMonths, monthGrid, fromLocalInput, mondayOf, publicationStatus, toLocalInput, weekDays } from './dates'

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

describe('month grid', () => {
  it('starts on Monday and covers the whole month', () => {
    const g = monthGrid('2026-09-15')
    expect(g[0][0]).toBe('2026-08-31')
    expect(g.at(-1)!.at(-1)).toBe('2026-10-04')
    expect(g).toHaveLength(5)
  })
  it('handles a month starting on Monday and February', () => {
    expect(monthGrid('2027-02-10')).toHaveLength(4) // Feb 2027 starts on Monday
    expect(monthGrid('2026-06-01')[0][0]).toBe('2026-06-01')
  })
  it('moves by months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01')
  })
})

describe('multi-day workouts', () => {
  it('computes the last day and the days covered', () => {
    expect(lastDay('2026-09-28', 7)).toBe('2026-10-04')
    expect(lastDay('2026-09-28')).toBe('2026-09-28')
    expect(coversDay('2026-09-28', 7, '2026-10-04')).toBe(true)
    expect(coversDay('2026-09-28', 7, '2026-10-05')).toBe(false)
    expect(coversDay('2026-09-28', 1, '2026-09-28')).toBe(true)
    expect(coversDay('2026-09-28', 3, '2026-09-27')).toBe(false)
  })
})

describe('seenAgo', () => {
  const now = new Date(2026, 9, 1, 9, 0)
  it('counts calendar days', () => {
    expect(seenAgo(new Date(2026, 9, 1, 1, 0).toISOString(), now)).toBe('auj.')
    expect(seenAgo(new Date(2026, 8, 30, 23, 0).toISOString(), now)).toBe('hier')
    expect(seenAgo(new Date(2026, 8, 28, 10, 0).toISOString(), now)).toBe('3 j')
    expect(seenAgo(new Date(2026, 5, 1).toISOString(), now)).toBe('4 mois')
  })
})
