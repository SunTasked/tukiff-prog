import { expect, it } from 'vitest'
import { groupByProgram } from './grouping'

const prog = (id: string, name: string) => ({ program_id: id, athlete_id: null, programs: { name } })
const everyone = { program_id: null, athlete_id: null }

it('groups the day by program, then Perso, then Général, without duplicates', () => {
  const workouts = [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }, { id: 'w4' }, { id: 'w5' }]
  const assignments = {
    w1: [prog('h', 'Hyrox')],
    w2: [prog('c', 'CrossFit'), prog('h', 'Hyrox')], // both: first alphabetically
    w3: [everyone],
    w4: [{ program_id: null, athlete_id: 'me' }],
    w5: [prog('x', 'Haltéro'), everyone], // not my program -> Général
  }
  const panels = groupByProgram(workouts, assignments, new Set(['h', 'c']), 'me')
  expect(panels.map((p) => [p.label, p.items.map((w) => w.id)])).toEqual([
    ['CrossFit', ['w2']],
    ['Hyrox', ['w1']],
    ['Perso', ['w4']],
    ['Général', ['w3', 'w5']],
  ])
})
