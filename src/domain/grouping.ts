// Groups the day's workouts into one panel per program (programs A→Z).

/** French A→Z, ignoring case and accents. */
export const compareNames = (a: string, b: string) => a.localeCompare(b, 'fr', { sensitivity: 'base' })

type Sortable = { program: string; title: string; publish_at: string | null }

/** Stable order for a day's workouts: program A→Z, then title, then publish time (drafts last). */
export function compareWorkouts(a: Sortable, b: Sortable): number {
  return (
    compareNames(a.program, b.program) ||
    compareNames(a.title, b.title) ||
    (a.publish_at ?? '\uffff').localeCompare(b.publish_at ?? '\uffff')
  )
}

export type Panel<T> = { key: string; label: string; items: T[] }

export function groupByProgram<T extends { program_id: string; program_name: string }>(workouts: T[]): Panel<T>[] {
  const panels = new Map<string, Panel<T>>()
  for (const w of workouts) {
    if (!panels.has(w.program_id)) panels.set(w.program_id, { key: w.program_id, label: w.program_name, items: [] })
    panels.get(w.program_id)!.items.push(w)
  }
  return [...panels.values()].sort((a, b) => compareNames(a.label, b.label))
}

/**
 * Home auto-scroll target: the first block, in display order, of the open panels that I neither
 * scored nor skipped. undefined when everything is done, or when it is the very first block
 * (already on screen, no need to hide the week strip).
 */
export function firstPendingBlock(
  workouts: { id: string; blocks: { id: string }[] }[],
  done: Map<string, Set<string>>,
): string | undefined {
  const blocks = workouts.flatMap((w) => w.blocks.map((b) => ({ id: b.id, done: done.get(w.id)?.has(b.id) ?? false })))
  const index = blocks.findIndex((b) => !b.done)
  return index > 0 ? blocks[index].id : undefined
}
