import { expect, it } from 'vitest'
import { firstPendingBlock, groupByProgram } from './grouping'

it('groups the day by program, A to Z, keeping workout order', () => {
  const w = (id: string, program_id: string, program_name: string) => ({ id, program_id, program_name })
  const panels = groupByProgram([w('1', 'h', 'Hyrox'), w('2', 'c', 'CrossFit'), w('3', 'h', 'Hyrox')])
  expect(panels.map((p) => [p.label, p.items.map((x) => x.id)])).toEqual([
    ['CrossFit', ['2']],
    ['Hyrox', ['1', '3']],
  ])
})

it('finds the first block neither scored nor skipped, except the very first one', () => {
  const w = (id: string, ...blocks: string[]) => ({ id, blocks: blocks.map((b) => ({ id: b })) })
  const day = [w('w1', 'a', 'b'), w('w2', 'c')]
  expect(firstPendingBlock(day, new Map([['w1', new Set(['a'])]]))).toBe('b')
  expect(firstPendingBlock(day, new Map([['w1', new Set(['a', 'b'])]]))).toBe('c')
  expect(firstPendingBlock(day, new Map([['w1', new Set(['a', 'b'])], ['w2', new Set(['c'])]]))).toBeUndefined()
  expect(firstPendingBlock(day, new Map())).toBeUndefined()
})
