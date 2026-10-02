import { describe, expect, it } from 'vitest'
import { compareWorkouts, groupByProgram } from './grouping'

it('groups the day by program, A to Z, keeping workout order', () => {
  const w = (id: string, program_id: string, program_name: string) => ({ id, program_id, program_name })
  const panels = groupByProgram([w('1', 'h', 'Hyrox'), w('2', 'c', 'CrossFit'), w('3', 'h', 'Hyrox')])
  expect(panels.map((p) => [p.label, p.items.map((x) => x.id)])).toEqual([
    ['CrossFit', ['2']],
    ['Hyrox', ['1', '3']],
  ])
})

describe('compareWorkouts', () => {
  const w = (program: string, title = 'WOD', publish_at: string | null = '2026-09-30T05:00:00Z') => ({ program, title, publish_at })
  it('orders by program A→Z ignoring case and accents, then title, then publish time', () => {
    const list = [
      w('PERSO TIM'),
      w('Kanda WOD'),
      w('élite'),
      w('Kanda WOD', 'Skill'),
      w('Kanda WOD', 'Skill', null),
      w('Kanda WOD', 'Skill', '2026-09-29T05:00:00Z'),
    ]
    expect(list.sort(compareWorkouts).map((x) => `${x.program}/${x.title}/${x.publish_at ?? '-'}`)).toEqual([
      'élite/WOD/2026-09-30T05:00:00Z',
      'Kanda WOD/Skill/2026-09-29T05:00:00Z',
      'Kanda WOD/Skill/2026-09-30T05:00:00Z',
      'Kanda WOD/Skill/-',
      'Kanda WOD/WOD/2026-09-30T05:00:00Z',
      'PERSO TIM/WOD/2026-09-30T05:00:00Z',
    ])
  })
})
