// Groups library items (templates, exercises) by section: sections A→Z, then the unsectioned ones.
export type SectionGroup<T> = { id: string | null; name: string; items: T[] }

export function groupBySection<T extends { section_id: string | null; name: string }>(
  items: T[],
  sections: { id: string; name: string }[],
): SectionGroup<T>[] {
  const sorted = [...sections].sort((a, b) => a.name.localeCompare(b.name))
  const byName = (a: T, b: T) => a.name.localeCompare(b.name)
  const known = new Set(sections.map((s) => s.id))
  const groups: SectionGroup<T>[] = sorted.map((s) => ({
    id: s.id,
    name: s.name,
    items: items.filter((t) => t.section_id === s.id).sort(byName),
  }))
  const rest = items.filter((t) => !t.section_id || !known.has(t.section_id)).sort(byName)
  if (rest.length) groups.push({ id: null, name: 'Sans section', items: rest })
  return groups
}
