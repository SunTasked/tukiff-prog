import { describe, expect, it } from 'vitest'
import {
  addItem,
  blockHeading,
  itemRuns,
  removeGroup,
  emptyItem,
  durationParts,
  formatDuration,
  formatSummary,
  invalidatedBlocks,
  itemSummary,
  newBlock,
  parseDuration,
  parseNumber,
  prefilledItem,
  shortDuration,
  suggestedKind,
  usedExercises,
  validateWorkout,
  viewAs,
  type WorkoutDraft,
} from './workout'

describe('durations', () => {
  it('formats', () => {
    expect(formatDuration(720)).toBe('12:00')
    expect(formatDuration(95)).toBe('1:35')
    expect(shortDuration(720)).toBe("12'")
    expect(shortDuration(90)).toBe("1'30")
    expect(shortDuration(20)).toBe('20"')
    expect(formatDuration(452.4)).toBe('7:32,4')
    expect(formatDuration(59.9)).toBe('0:59,9')
  })

  it('parses minutes and seconds typed separately', () => {
    expect(parseDuration('7', '32,4')).toBe(452.4)
    expect(parseDuration('7', '32.4')).toBe(452.4)
    expect(parseDuration('7', '32,')).toBe(452)
    expect(parseDuration('7', '')).toBe(420)
    expect(parseDuration('', '45')).toBe(45)
    expect(parseDuration('', '')).toBeNull()
    expect(parseDuration('7', '60')).toBeUndefined()
    expect(parseDuration('7', '32,45')).toBeUndefined()
    expect(parseDuration('a', '12')).toBeUndefined()
  })

  it('splits a duration back into its fields', () => {
    expect(durationParts(452.4)).toEqual(['7', '32,4'])
    expect(durationParts(65)).toEqual(['1', '05'])
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
    expect(formatSummary('for_time', { time_cap_s: 1200, stage_s: 240 })).toBe("For Time · cap 20' · paliers 4'")
    expect(formatSummary('for_time', { time_cap_s: 720, stage_s: 360, stage_step_s: 180 })).toBe("For Time · cap 12' · paliers 6' +3'")
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
  const thruster = { ...emptyItem('t'), reps: '21-15-9', load_kg: 43 }

  it('summarizes', () => {
    expect(itemSummary(thruster, lookup)).toBe('21-15-9 Thruster @ 43 kg')
    expect(itemSummary({ ...emptyItem(null, 'Course'), distance_m: 400 }, lookup)).toBe('400 m Course')
    expect(itemSummary({ ...emptyItem('p'), reps: '5', pct_1rm: 80, load_kg: 100 }, lookup)).toBe('5 Pull-up @ 100 kg / 80 %')
  })

  it('shows the women\'s load when it differs', () => {
    const ohs = { ...emptyItem('t'), reps: '21', load_kg: 43, load_kg_f: 29 }
    expect(itemSummary(ohs, lookup)).toBe('21 Thruster @ 43/29 kg')
    expect(itemSummary({ ...ohs, load_kg_f: 43 }, lookup)).toBe('21 Thruster @ 43 kg')
  })
})

describe('faster entry', () => {
  const ohs = { ...emptyItem('ohs'), reps: '21', load_kg: 43, load_kg_f: 29 }
  const w: WorkoutDraft = {
    title: 'Josh',
    notes: '',
    blocks: [
      { ...newBlock('warmup', 'a'), items: [emptyItem('row'), emptyItem('pu')] },
      { ...newBlock('metcon', 'b'), items: [ohs, { ...emptyItem('pu'), reps: '42' }] },
    ],
  }

  it('lists exercises of the workout, current block and latest first', () => {
    expect(usedExercises(w, 1)).toEqual(['pu', 'ohs', 'row'])
    expect(usedExercises(w, 0)).toEqual(['pu', 'row', 'ohs'])
  })

  it('prefills loads from the nearest use, not the reps', () => {
    expect(prefilledItem(w, 1, 'ohs')).toEqual({ ...emptyItem('ohs'), load_kg: 43, load_kg_f: 29 })
    expect(prefilledItem(w, 1, 'new')).toEqual(emptyItem('new'))
  })
})

describe('blocks & validation', () => {
  it('suggests a class structure', () => {
    expect([0, 1, 2, 3].map(suggestedKind)).toEqual(['warmup', 'strength', 'metcon', 'accessory'])
    expect(newBlock('metcon', 'x')).toMatchObject({ kind: 'metcon', format: 'none', params: {} })
  })
  it('validates', () => {
    expect(validateWorkout({ title: ' ', notes: '', blocks: [] })).toMatch(/titre/)
    const b = { ...newBlock('metcon', 'x'), items: [emptyItem()] }
    expect(validateWorkout({ title: 'Fran', notes: '', blocks: [b] })).toMatch(/Bloc A : donne-lui un titre/)
    b.title = 'Fran'
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
  it('keeps the scores when only the access level, the ranking, the scaling options or the sponsor change', () => {
    const d = base()
    d.blocks[1].params = { ...d.blocks[1].params, min_level: 1, ranked: false, scaling: 'Ring row', sponsor_id: 's1' }
    expect(invalidatedBlocks(base(), d)).toEqual({ changed: [], removed: [] })
  })
})

describe('sub-blocks', () => {
  const g = (id: string, group: number | null) => ({ ...emptyItem(id), group })
  const block = { ...newBlock('metcon', 'b'), groups: [{ title: 'DB DT', note: '' }, { title: 'Vide', note: '' }], items: [g('dl', 0), g('pc', 0), g('bbjo', null)] }

  it('groups consecutive items, empty sub-blocks last', () => {
    expect(itemRuns(block).map((r) => [r.group, r.items.map((i) => i.index)])).toEqual([[0, [0, 1]], [null, [2]], [1, []]])
  })
  it('adds an item at the end of its sub-block', () => {
    expect(addItem(block, emptyItem('pj'), 0).map((i) => i.exercise_id)).toEqual(['dl', 'pc', 'pj', 'bbjo'])
    expect(addItem(block, emptyItem('x'), 1).at(-1)).toMatchObject({ exercise_id: 'x', group: 1 })
    expect(addItem(block, emptyItem('y')).at(-1)).toMatchObject({ exercise_id: 'y', group: null })
  })
  it('removing a sub-block keeps its items', () => {
    const r = removeGroup({ ...block, items: [...block.items, g('x', 1)] }, 0)
    expect(r.groups.map((x) => x.title)).toEqual(['Vide'])
    expect(r.items.map((i) => i.group)).toEqual([null, null, null, 0])
  })
})

describe('viewAs', () => {
  const block = (id: string, min_level?: number) => ({ ...newBlock('metcon', id), params: min_level ? { min_level } : {} })
  const w: WorkoutDraft = {
    title: 'WOD',
    notes: '',
    access_levels: [
      { name: 'Accessoires', preview: true },
      { name: 'Élite', preview: false },
    ],
    blocks: [block('pre', 1), block('wod'), block('elite', 2), block('post', 1)],
  }

  it('locks previewable blocks above the level and hides the others', () => {
    const base = viewAs(w, 0)
    expect(base.blocks.map((b) => b.id)).toEqual(['wod'])
    expect(base.locked!.map((l) => [l.id, l.before])).toEqual([
      ['pre', 0],
      ['post', 1],
    ])
  })

  it('shows everything up to the level', () => {
    expect(viewAs(w, 1).blocks.map((b) => b.id)).toEqual(['pre', 'wod', 'post'])
    expect(viewAs(w, 1).locked).toEqual([])
    expect(viewAs(w, 2).blocks).toHaveLength(4)
  })
})

it('block heading does not repeat a title copied from the format', () => {
  const b = { ...newBlock('metcon', 'h'), format: 'amrap' as const, params: { duration_s: 1200 } }
  expect(blockHeading({ ...b, title: "AMRAP 20'" })).toBe("AMRAP 20'")
  expect(blockHeading({ ...b, title: 'DB DT' })).toBe("DB DT — AMRAP 20'")
})
