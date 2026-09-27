// Groups the day's workouts into one panel per program (as seen by the current member).

export type GroupAssignment = { program_id: string | null; athlete_id: string | null; programs?: { name: string } | null }
export type Panel<T> = { key: string; label: string; programName: string | null; items: T[] }

/**
 * A workout goes to the first (alphabetical) of MY programs it targets, else "Perso" if it targets me,
 * else "Général". Never duplicated across panels. Panels: programs A→Z, then Perso, then Général.
 */
export function groupByProgram<T extends { id?: string }>(
  workouts: T[],
  assignments: Record<string, GroupAssignment[]>,
  myPrograms: Set<string>,
  me: string | undefined,
): Panel<T>[] {
  const panels = new Map<string, Panel<T>>()
  for (const w of workouts) {
    const list = assignments[w.id ?? ''] ?? []
    const program = list
      .filter((a) => a.program_id && myPrograms.has(a.program_id))
      .map((a) => ({ id: a.program_id!, name: a.programs?.name ?? 'Programme' }))
      .sort((a, b) => a.name.localeCompare(b.name))[0]
    const panel: Omit<Panel<T>, 'items'> = program
      ? { key: program.id, label: program.name, programName: program.name }
      : list.some((a) => a.athlete_id === me)
        ? { key: 'perso', label: 'Perso', programName: null }
        : { key: 'general', label: 'Général', programName: null }
    if (!panels.has(panel.key)) panels.set(panel.key, { ...panel, items: [] })
    panels.get(panel.key)!.items.push(w)
  }
  const rank = (p: Panel<T>) => (p.programName ? 0 : p.key === 'perso' ? 1 : 2)
  return [...panels.values()].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label))
}
