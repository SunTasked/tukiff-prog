// Groups library templates by section: sections A→Z, then the unsectioned ones.
export type SectionGroup<T> = { id: string | null; name: string; items: T[] }

export function groupBySection<T extends { section_id: string | null; title: string }>(
  templates: T[],
  sections: { id: string; name: string }[],
): SectionGroup<T>[] {
  const sorted = [...sections].sort((a, b) => a.name.localeCompare(b.name))
  const byTitle = (a: T, b: T) => a.title.localeCompare(b.title)
  const known = new Set(sections.map((s) => s.id))
  const groups: SectionGroup<T>[] = sorted.map((s) => ({
    id: s.id,
    name: s.name,
    items: templates.filter((t) => t.section_id === s.id).sort(byTitle),
  }))
  const rest = templates.filter((t) => !t.section_id || !known.has(t.section_id)).sort(byTitle)
  if (rest.length) groups.push({ id: null, name: 'Sans section', items: rest })
  return groups
}
