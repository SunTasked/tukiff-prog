import { describe, expect, it } from 'vitest'
import { buildReport, reportTotals, sessionStatus, type ReportResult, type ReportWorkout } from './report'

const score = { time_s: null, capped: false, rounds: null, reps: null, load_kg: null }
const res = (block_id: string, athlete_id: string, extra: Partial<ReportResult> = {}): ReportResult => ({
  ...score,
  block_id,
  athlete_id,
  rx: true,
  comment: null,
  gender: 'male',
  ...extra,
})

const workouts: ReportWorkout[] = [
  {
    id: 'w1',
    date: '2026-09-22',
    title: 'Séance 1',
    program: 'WOD',
    blocks: [
      { id: 'b1', label: 'A · Back squat', type: 'load', exerciseIds: ['squat'] },
      { id: 'b2', label: 'B · Fran', type: 'time', exerciseIds: [] },
      { id: 'b3', label: 'C · Mobilité', type: 'none', exerciseIds: [] },
    ],
  },
  {
    id: 'w2',
    date: '2026-09-24',
    title: 'Séance 2',
    program: 'WOD',
    blocks: [{ id: 'b4', label: 'A · Aérobie', type: 'none', exerciseIds: [] }],
  },
]

describe('sessionStatus', () => {
  it('classifies sessions', () => {
    expect(sessionStatus([{ status: 'done' }, { status: 'done' }])).toBe('done')
    expect(sessionStatus([{ status: 'done' }, { status: 'skipped' }])).toBe('partial')
    expect(sessionStatus([{ status: 'skipped' }, { status: 'empty' }])).toBe('skipped')
    expect(sessionStatus([{ status: 'empty' }])).toBe('missed')
    expect(sessionStatus([])).toBe('missed')
  })
})

describe('buildReport', () => {
  const results = [
    res('b1', 'me', { load_kg: 100, comment: 'dur' }),
    res('b1', 'x', { load_kg: 120 }),
    res('b1', 'y', { load_kg: 130, rx: false }),
    res('b1', 'z', { load_kg: 140, gender: 'female' }),
    res('b3', 'me'),
  ]
  const sessions = buildReport('me', workouts, results, new Set(['b2', 'b4']), new Map([['b1', '🔥']]), [
    { exercise_id: 'squat', benchmark_name: null, date: '2026-09-22' },
    { exercise_id: null, benchmark_name: 'fran', date: '2026-09-21' },
  ])

  it('lists sessions newest first with their status', () => {
    expect(sessions.map((s) => [s.workout.id, s.status])).toEqual([
      ['w2', 'skipped'],
      ['w1', 'partial'],
    ])
  })

  it('ranks among the RX of the same gender, never a scaled score', () => {
    const row = sessions[1].rows[0]
    expect(row).toMatchObject({ status: 'done', score: '100 kg', rank: { rank: 2, of: 2 }, comment: 'dur', emoji: '🔥', record: true })
    const scaled = buildReport('y', workouts, results, new Set(), new Map(), [])[1].rows[0]
    expect(scaled).toMatchObject({ score: '130 kg', rx: false, rank: undefined })
  })

  it('marks skipped blocks, done blocks without score, and records only on the same day', () => {
    expect(sessions[1].rows[1]).toMatchObject({ status: 'skipped', record: false })
    expect(sessions[1].rows[2]).toMatchObject({ status: 'done', score: 'Fait', rank: undefined })
  })

  it('totals', () => {
    expect(reportTotals(sessions, [{ exercise_id: 'squat', benchmark_name: null, date: '2026-09-22' }])).toEqual({
      sessions: 2,
      attended: 1,
      blocks: 4,
      done: 2,
      skipped: 2,
      records: 1,
    })
  })
})
