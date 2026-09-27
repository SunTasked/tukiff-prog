import { expect, it } from 'vitest'
import { groupByProgram } from './grouping'

it('groups the day by program, A to Z, keeping workout order', () => {
  const w = (id: string, program_id: string, program_name: string) => ({ id, program_id, program_name })
  const panels = groupByProgram([w('1', 'h', 'Hyrox'), w('2', 'c', 'CrossFit'), w('3', 'h', 'Hyrox')])
  expect(panels.map((p) => [p.label, p.items.map((x) => x.id)])).toEqual([
    ['CrossFit', ['2']],
    ['Hyrox', ['1', '3']],
  ])
})
