import { describe, expect, it } from 'vitest'
import { compareScores, emptyScore, formatScore, leaderboards, normalizeScore, rankResults, scoreType, validateScore, type Score } from './scoring'

const s = (v: Partial<Score>): Score => ({ ...emptyScore(), ...v })
const names = <T extends { name: string }>(rows: { result: T; rank: number }[]) => rows.map((r) => `${r.rank}:${r.result.name}`)

describe('scoreType', () => {
  it('derives the score from the format', () => {
    expect(scoreType('for_time')).toBe('time')
    expect(scoreType('amrap')).toBe('rounds_reps')
    expect(scoreType('sets_reps')).toBe('load')
    expect(scoreType('tabata')).toBe('reps')
    expect(scoreType('emom')).toBe('none')
    expect(scoreType('none')).toBe('none')
  })
})

describe('For Time', () => {
  const list = [
    { name: 'capped-40', ...s({ capped: true, reps: 40 }) },
    { name: '8:10', ...s({ time_s: 490 }) },
    { name: 'capped-55', ...s({ capped: true, reps: 55 }) },
    { name: '6:30', ...s({ time_s: 390 }) },
  ]
  it('ranks finishers by time, then capped athletes by reps', () => {
    expect(names(rankResults('time', list))).toEqual(['1:6:30', '2:8:10', '3:capped-55', '4:capped-40'])
  })
  it('a slow finisher beats any capped athlete', () => {
    expect(compareScores('time', s({ time_s: 1499 }), s({ capped: true, reps: 999 }))).toBeLessThan(0)
  })
})

describe('AMRAP', () => {
  it('ranks by rounds then reps', () => {
    const list = [
      { name: '5+10', ...s({ rounds: 5, reps: 10 }) },
      { name: '6+0', ...s({ rounds: 6, reps: 0 }) },
      { name: '5+12', ...s({ rounds: 5, reps: 12 }) },
    ]
    expect(names(rankResults('rounds_reps', list))).toEqual(['1:6+0', '2:5+12', '3:5+10'])
  })
})

describe('load and reps', () => {
  it('ranks the heaviest first', () => {
    const list = [{ name: '100', ...s({ load_kg: 100 }) }, { name: '122,5', ...s({ load_kg: 122.5 }) }]
    expect(names(rankResults('load', list))).toEqual(['1:122,5', '2:100'])
  })
  it('ranks the most reps first, missing last', () => {
    const list = [{ name: 'none', ...s({}) }, { name: '80', ...s({ reps: 80 }) }]
    expect(names(rankResults('reps', list))).toEqual(['1:80', '2:none'])
  })
})

it('gives ties the same rank (1, 2, 2, 4)', () => {
  const list = [
    { name: 'a', ...s({ time_s: 300 }) },
    { name: 'b', ...s({ time_s: 320 }) },
    { name: 'c', ...s({ time_s: 320 }) },
    { name: 'd', ...s({ time_s: 400 }) },
  ]
  expect(rankResults('time', list).map((r) => r.rank)).toEqual([1, 2, 2, 4])
})

it('never mixes levels: one board per level, in level order', () => {
  const list = [
    { name: 'scaled-fast', level: 'scaled', ...s({ time_s: 200 }) },
    { name: 'rx-slow', level: 'rx', ...s({ time_s: 600 }) },
    { name: 'rx-fast', level: 'rx', ...s({ time_s: 400 }) },
    { name: 'elite', level: 'elite', ...s({ time_s: 500 }) },
  ]
  const boards = leaderboards('time', list)
  expect(boards.map((b) => b.level)).toEqual(['elite', 'rx', 'scaled'])
  expect(names(boards[1].rows)).toEqual(['1:rx-fast', '2:rx-slow'])
  expect(names(boards[2].rows)).toEqual(['1:scaled-fast'])
})

describe('format, validate, normalize', () => {
  it('formats', () => {
    expect(formatScore('time', s({ time_s: 452 }))).toBe('7:32')
    expect(formatScore('time', s({ capped: true, reps: 45 }))).toBe('CAP + 45 reps')
    expect(formatScore('rounds_reps', s({ rounds: 5, reps: 12 }))).toBe('5 rds + 12')
    expect(formatScore('rounds_reps', s({ rounds: 6, reps: 0 }))).toBe('6 rds')
    expect(formatScore('load', s({ load_kg: 102.5 }))).toBe('102,5 kg')
    expect(formatScore('none', s({}))).toBe('Fait')
  })
  it('validates', () => {
    expect(validateScore('time', s({}))).toMatch(/temps/)
    expect(validateScore('time', s({ capped: true }))).toMatch(/reps/)
    expect(validateScore('time', s({ capped: true, reps: 30 }))).toBeNull()
    expect(validateScore('rounds_reps', s({ reps: 3 }))).toMatch(/rounds/)
    expect(validateScore('load', s({ load_kg: 80 }))).toBeNull()
    expect(validateScore('none', s({}))).toBeNull()
  })
  it('drops irrelevant fields', () => {
    expect(normalizeScore('time', s({ capped: true, reps: 30, time_s: 999 }))).toEqual(s({ capped: true, reps: 30 }))
    expect(normalizeScore('rounds_reps', s({ rounds: 4, load_kg: 50 }))).toEqual(s({ rounds: 4, reps: 0 }))
  })
})
