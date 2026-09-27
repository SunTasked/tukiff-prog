import { expect, it } from 'vitest'
import { groupBySection } from './sections'

it('groups templates by section A→Z, unsectioned last, titles sorted', () => {
  const t = (name: string, section_id: string | null) => ({ name, section_id })
  const groups = groupBySection(
    [t('Hyrox sim', 'h'), t('Fran', 'b'), t('Cindy', 'b'), t('Test', null), t('Orphan', 'deleted')],
    [
      { id: 'h', name: 'Hyrox' },
      { id: 'b', name: 'Benchmark CrossFit' },
      { id: 'e', name: 'Empty' },
    ],
  )
  expect(groups.map((g) => [g.name, g.items.map((i) => i.name)])).toEqual([
    ['Benchmark CrossFit', ['Cindy', 'Fran']],
    ['Empty', []],
    ['Hyrox', ['Hyrox sim']],
    ['Sans section', ['Orphan', 'Test']],
  ])
})
