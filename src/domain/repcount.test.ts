import { describe, expect, it } from 'vitest'
import { groupRounds, itemCount, repPlan, roundReps, totalReps } from './repcount'
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
})
