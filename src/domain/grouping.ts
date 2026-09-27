// Groups the day's workouts into one panel per program (programs A→Z).

export type Panel<T> = { key: string; label: string; items: T[] }

export function groupByProgram<T extends { program_id: string; program_name: string }>(workouts: T[]): Panel<T>[] {
  const panels = new Map<string, Panel<T>>()
  for (const w of workouts) {
    if (!panels.has(w.program_id)) panels.set(w.program_id, { key: w.program_id, label: w.program_name, items: [] })
    panels.get(w.program_id)!.items.push(w)
  }
  return [...panels.values()].sort((a, b) => a.label.localeCompare(b.label))
}
