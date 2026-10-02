import { describe, expect, it } from 'vitest'
import { emptyScore } from './scoring'
import { bestBenchmarks, bestLoads, bestMaxes, formatMax, loadFromPct, oneRepMaxes } from './records'

it('computes a load from a % of the 1RM, rounded to 1 kg', () => {
  expect(loadFromPct(100, 80)).toBe(80)
  expect(loadFromPct(97, 75)).toBe(73) // 72.75
  expect(loadFromPct(142.5, 70)).toBe(100) // 99.75
  expect(loadFromPct(60, 82.5)).toBe(50) // 49.5 rounds up
})

describe('loads', () => {
  const recs = [
    { exercise_id: 'sq', rep_max: 1, load_kg: 120, date: '2026-01-01' },
    { exercise_id: 'sq', rep_max: 1, load_kg: 130, date: '2026-03-01' },
    { exercise_id: 'sq', rep_max: 5, load_kg: 105, date: '2026-02-01' },
    { exercise_id: 'dl', rep_max: 3, load_kg: 160, date: '2026-02-01' },
  ]
  it('keeps the heaviest per exercise and rep max', () => {
    const best = bestLoads(recs)
    expect(best.get('sq')!.get(1)!.load_kg).toBe(130)
    expect(best.get('sq')!.get(5)!.load_kg).toBe(105)
  })
  it('uses true 1RMs only', () => {
    expect(oneRepMaxes(recs)).toEqual(new Map([['sq', 130]]))
  })
})

it('keeps the best benchmark score per name', () => {
  const b = (name: string, time_s: number) => ({ ...emptyScore(), benchmark_name: name, score_type: 'time' as const, time_s, date: '2026-01-01' })
  const best = bestBenchmarks([b('Fran', 300), b('fran ', 260), b('Fran', 280), b('Grace', 200)])
  expect(best.get('fran')!.time_s).toBe(260)
  expect(best.get('grace')!.time_s).toBe(200)
})

it('keeps the highest max per exercise and formats it in the exercise unit', () => {
  const m = (exercise_id: string, value: number) => ({ exercise_id, value, date: '2026-01-01' })
  const best = bestMaxes([m('vup', 25), m('vup', 31), m('plank', 90)])
  expect(best.get('vup')!.value).toBe(31)
  expect(formatMax('reps', 31)).toBe('31 reps')
  expect(formatMax('time', 90)).toBe('1:30')
  expect(formatMax('distance', 400)).toBe('400 m')
  expect(formatMax('calories', 30)).toBe('30 cal')
})
