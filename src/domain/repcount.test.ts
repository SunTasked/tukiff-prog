import { describe, expect, it } from 'vitest'
import { formatBreakdown, groupRounds, itemCount, repBreakdown, repPlan, roundReps, totalReps } from './repcount'
import { emptyItem, newBlock } from './workout'

// DB DT ladder: N rounds of (12 DL + 9 HPC + 6 PJ), then 15 burpees box jump over.
const g = (reps: string, group: number | null) => ({ ...emptyItem('x'), reps, group })
const ladder = {
  ...newBlock('metcon', 'b'),
  groups: [{ title: 'DB DT', note: '', start: 1, step: 1 }],
  items: [g('12', 0), g('9', 0), g('6', 0), g('15', null)],
}

describe('repcount', () => {
  it('counts reps or calories only', () => {
    expect(itemCount({ ...emptyItem(), reps: ' 12 ' })).toBe(12)
    expect(itemCount({ ...emptyItem(), calories: 20 })).toBe(20)
    expect(itemCount({ ...emptyItem(), reps: '21-15-9' })).toBeNull()
    expect(itemCount({ ...emptyItem(), distance_m: 400 })).toBeNull()
  })
  it('sub-block rounds default to once per round', () => {
    expect(groupRounds({ title: '', note: '' }, 5)).toBe(1)
    expect(groupRounds({ title: '', note: '', start: 1, step: 1 }, 3)).toBe(3)
  })
  it('ladder totals', () => {
    const p = repPlan(ladder)!
    expect(p).toMatchObject({ groupReps: [27], plainReps: 15 })
    expect([1, 2, 3].map((r) => roundReps(p, r))).toEqual([42, 69, 96])
    expect(totalReps(p, 2, [0], 0)).toBe(111)
    // 3 rounds done, then 2 DB DT and 5 reps into round 4.
    expect(totalReps(p, 3, [2], 5)).toBe(207 + 54 + 5)
  })
  it('no plan when a movement is not countable', () => {
    expect(repPlan({ ...ladder, items: [...ladder.items, g('max', null)] })).toBeNull()
    expect(repPlan(newBlock('metcon', 'e'))).toBeNull()
  })
  it('breaks a total back into rounds, ladder rounds and reps', () => {
    const b = (total: number) => formatBreakdown(repBreakdown(ladder, total)!)
    expect(b(207 + 54 + 5)).toBe('3 tours + 2 DB DT + 5 reps')
    expect(b(42)).toBe('1 tour')
    expect(b(20)).toBe('0 tour + 20 reps')
    // All 4 DB DT of round 4 done, then 10 burpees.
    expect(b(207 + 108 + 10)).toBe('3 tours + 4 DB DT + 10 reps')
    expect(repBreakdown(ladder, 0)).toBeNull()
  })
  it('plain rounds without sub-blocks', () => {
    const plain = { ...newBlock('metcon', 'p'), items: [g('10', null), g('5', null)] }
    expect(formatBreakdown(repBreakdown(plain, 47)!)).toBe('3 tours + 2 reps')
  })
})
