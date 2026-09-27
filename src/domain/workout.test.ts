import { describe, expect, it } from 'vitest'
import {
  emptyItem,
  formatDuration,
  formatSummary,
  invalidatedBlocks,
  itemSummary,
  newBlock,
  parseNumber,
  resolveItem,
  shortDuration,
  suggestedKind,
  validateWorkout,
} from './workout'

describe('durations', () => {
  it('formats', () => {
    expect(formatDuration(720)).toBe('12:00')
    expect(formatDuration(95)).toBe('1:35')
    expect(shortDuration(720)).toBe("12'")
    expect(shortDuration(90)).toBe("1'30")
    expect(shortDuration(20)).toBe('20"')
  })
})

it('parses numbers with comma', () => {
  expect(parseNumber('42,5')).toBe(42.5)
  expect(parseNumber('')).toBeNull()
  expect(parseNumber('-3')).toBeNull()
})

describe('formatSummary', () => {
  it('covers each format', () => {
    expect(formatSummary('for_time', { time_cap_s: 720 })).toBe("For Time · cap 12'")
    expect(formatSummary('for_time', { rounds: 5 })).toBe('5 rounds For Time')
    expect(formatSummary('amrap', { duration_s: 900 })).toBe("AMRAP 15'")
    expect(formatSummary('emom', { interval_s: 60, rounds: 10 })).toBe("EMOM 10'")
    expect(formatSummary('emom', { interval_s: 120, rounds: 5 })).toBe("E2'MOM 10'")
    expect(formatSummary('tabata', { rounds: 8, work_s: 20, rest_s: 10 })).toBe('Tabata 8 × 20"/10"')
    expect(formatSummary('sets_reps', { sets: 5 })).toBe('5 séries')
    expect(formatSummary('none', {})).toBe('')
  })
})

describe('items', () => {
  const names: Record<string, string> = { t: 'Thruster', p: 'Pull-up', r: 'Ring Row' }
  const lookup = (id: string) => names[id]
  const thruster = { ...emptyItem('t'), reps: '21-15-9', load_kg: 43, levels: { scaled: { load_kg: 30 }, foundation: { load_kg: 15, reps: '15-12-9' } } }

  it('summarizes', () => {
    expect(itemSummary(thruster, lookup)).toBe('21-15-9 Thruster @ 43 kg')
    expect(itemSummary({ ...emptyItem(null, 'Course'), distance_m: 400 }, lookup)).toBe('400 m Course')
    expect(itemSummary({ ...emptyItem('p'), reps: '5', pct_1rm: 80, load_kg: 100 }, lookup)).toBe('5 Pull-up @ 100 kg / 80 %')
  })

  it('applies level overrides on top of RX', () => {
    expect(resolveItem(thruster, 'rx').load_kg).toBe(43)
    expect(resolveItem(thruster, 'elite').load_kg).toBe(43)
    expect(resolveItem(thruster, 'scaled')).toMatchObject({ load_kg: 30, reps: '21-15-9' })
    expect(resolveItem(thruster, 'foundation')).toMatchObject({ load_kg: 15, reps: '15-12-9' })
    const pullup = { ...emptyItem('p'), reps: '10', levels: { foundation: { exercise_id: 'r' } } }
    expect(itemSummary(resolveItem(pullup, 'foundation'), lookup)).toBe('10 Ring Row')
  })
})

describe('blocks & validation', () => {
  it('suggests a class structure', () => {
    expect([0, 1, 2, 3].map(suggestedKind)).toEqual(['warmup', 'strength', 'metcon', 'accessory'])
    expect(newBlock('metcon', 'x')).toMatchObject({ format: 'for_time', params: { time_cap_s: 720 } })
  })
  it('validates', () => {
    expect(validateWorkout({ title: ' ', notes: '', blocks: [] })).toMatch(/titre/)
    const b = { ...newBlock('metcon', 'x'), items: [emptyItem()] }
    expect(validateWorkout({ title: 'Fran', notes: '', blocks: [b] })).toMatch(/Bloc 1/)
    b.items[0] = emptyItem('t')
    expect(validateWorkout({ title: 'Fran', notes: '', blocks: [b] })).toBeNull()
  })
})

describe('invalidatedBlocks', () => {
  const base = () => ({
    title: 'W',
    notes: '',
    blocks: [
      { ...newBlock('strength', 'a'), items: [{ ...emptyItem('sq'), reps: '5', load_kg: 100 }] },
      { ...newBlock('metcon', 'b'), items: [emptyItem('t')] },
    ],
  })
  it('ignores title, notes, workout title and reordering', () => {
    const d = base()
    d.title = 'Other'
    d.blocks[0].title = 'Squat'
    d.blocks[0].notes = 'Tempo'
    d.blocks.reverse()
    expect(invalidatedBlocks(base(), d)).toEqual({ changed: [], removed: [] })
  })
  it('detects scoring changes and removed blocks', () => {
    const d = base()
    d.blocks[0].items[0].load_kg = 110
    d.blocks.pop()
    expect(invalidatedBlocks(base(), d)).toEqual({ changed: ['a'], removed: ['b'] })
    const e = base()
    e.blocks[1].params = { time_cap_s: 600 }
    expect(invalidatedBlocks(base(), e).changed).toEqual(['b'])
  })
})
