import { describe, expect, it } from 'vitest'
import { allGenders, boardPlaces, compactRows, myGenderFirst, compareScores, emptyScore, formatScore, leaderboards, weeklyLeaderboards, normalizeScore, rankResults, scoreType, validateScore, type Score } from './scoring'

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
  it('keeps the coach choice', () => {
    expect(scoreType('amrap', { score: 'reps' })).toBe('reps')
    expect(scoreType('emom', { interval_s: 90, score: 'load' })).toBe('load')
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

it('one board per gender, levels stacked in level order, ranked within each level', () => {
  const list = [
    { name: 'scaled-fast', level: 'scaled', gender: 'male' as const, ...s({ time_s: 200 }) },
    { name: 'rx-slow', level: 'rx', gender: 'male' as const, ...s({ time_s: 600 }) },
    { name: 'rx-fast', level: 'rx', gender: null, ...s({ time_s: 400 }) },
    { name: 'elite', level: 'elite', gender: 'male' as const, ...s({ time_s: 500 }) },
    { name: 'f-rx', level: 'rx', gender: 'female' as const, ...s({ time_s: 300 }) },
  ]
  const boards = leaderboards('time', list)
  expect(boards.map((b) => b.gender)).toEqual(['male', 'female'])
  expect(boards[0].rows.map((r) => `${r.level}:${r.rank}:${r.result.name}`)).toEqual([
    'elite:1:elite',
    'rx:1:rx-fast',
    'rx:2:rx-slow',
    'scaled:1:scaled-fast',
  ])
  expect(names(boards[1].rows)).toEqual(['1:f-rx'])
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

describe('compact and weekly boards', () => {
  const r = (athlete_id: string, level: string, v: Partial<Score>, gender: 'male' | 'female' = 'male') => ({
    ...s(v),
    athlete_id,
    level,
    gender,
  })

  it('keeps the top 3 of each level plus me', () => {
    const list = ['a', 'b', 'c', 'd', 'e'].map((id, i) => r(id, 'rx', { reps: 100 - i }))
    const rows = leaderboards('reps', [...list, r('x', 'scaled', { reps: 1 })])[0].rows
    expect(compactRows(rows, 'e').map((row) => row.result.athlete_id)).toEqual(['a', 'b', 'c', 'e', 'x'])
    expect(compactRows(rows, 'b').map((row) => row.result.athlete_id)).toEqual(['a', 'b', 'c', 'x'])
  })

  it('places levels one after the other', () => {
    const rows = leaderboards('reps', [r('a', 'elite', { reps: 5 }), r('b', 'rx', { reps: 50 }), r('c', 'rx', { reps: 50 }), r('d', 'rx', { reps: 10 })])[0].rows
    expect(boardPlaces(rows)).toEqual([1, 2, 2, 4])
  })

  it('sums places, missed block = last + 1, per gender, lowest wins', () => {
    const boards = weeklyLeaderboards([
      { type: 'reps', results: [r('a', 'rx', { reps: 30 }), r('b', 'rx', { reps: 20 }), r('f', 'rx', { reps: 1 }, 'female')] },
      { type: 'time', results: [r('b', 'rx', { time_s: 100 }), r('c', 'rx', { time_s: 200 })] },
      { type: 'none', results: [r('d', 'rx', {})] },
    ])
    const men = boards[0]
    expect(men.gender).toBe('male')
    expect(men.blocks).toBe(2)
    // a: 1 + (2 + 1) = 4, b: 2 + 1 = 3, c: (2 + 1) + 2 = 5; d only did a block without score.
    expect(men.rows.map((row) => `${row.rank}:${row.athlete.athlete_id}:${row.total}`)).toEqual(['1:b:3', '2:a:4', '3:c:5'])
    expect(men.rows[1].places).toEqual([{ place: 1, missed: false }, { place: 3, missed: true }])
    expect(boards[1]).toMatchObject({ gender: 'female', blocks: 1, rows: [{ total: 1, rank: 1 }] })
  })
})

describe('myGenderFirst', () => {
  const boards = [{ gender: 'male' as const }, { gender: 'female' as const }]
  it('puts the viewer gender first', () => {
    expect(myGenderFirst(boards, 'female').map((b) => b.gender)).toEqual(['female', 'male'])
    expect(myGenderFirst(boards, 'male').map((b) => b.gender)).toEqual(['male', 'female'])
    expect(myGenderFirst(boards, null).map((b) => b.gender)).toEqual(['male', 'female'])
  })
})

it('allGenders fills the missing boards', () => {
  const boards = allGenders([{ gender: 'female' as const, rows: [1] }], (gender) => ({ gender, rows: [] as number[] }))
  expect(boards).toEqual([
    { gender: 'male', rows: [] },
    { gender: 'female', rows: [1] },
  ])
})
