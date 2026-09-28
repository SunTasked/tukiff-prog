// Reps of an AMRAP scored in total reps, from what the athlete counts: rounds done, sub-block rounds and extra reps.
import type { BlockDraft, GroupDraft, ItemDraft } from './workout'

/** Reps counted for one movement: a plain number of reps, else calories; null when not countable ("21-15-9", "max", 400 m). */
export function itemCount(item: ItemDraft): number | null {
  const reps = item.reps.trim()
  if (/^\d+$/.test(reps)) return Number(reps)
  if (!reps && item.calories != null) return item.calories
  return null
}

/** Rounds of a sub-block in the n-th round (1-based) of the block. */
export const groupRounds = (g: GroupDraft, round: number) => Math.max(0, (g.start ?? 1) + (round - 1) * (g.step ?? 0))

export type RepPlan = {
  /** Reps of one round of each sub-block. */
  groupReps: number[]
  /** Reps of the movements outside sub-blocks, done once per round. */
  plainReps: number
  groups: GroupDraft[]
}

/** null when a movement cannot be counted in reps. */
export function repPlan(block: BlockDraft): RepPlan | null {
  const counts = block.items.map(itemCount)
  if (!block.items.length || counts.some((c) => c === null)) return null
  const groupReps = block.groups.map((_, g) => block.items.reduce((sum, it, i) => sum + (it.group === g ? counts[i]! : 0), 0))
  const plainReps = block.items.reduce((sum, it, i) => sum + (it.group === null ? counts[i]! : 0), 0)
  return { groupReps, plainReps, groups: block.groups }
}

/** Reps of the n-th round of the block. */
export const roundReps = (p: RepPlan, round: number) =>
  p.plainReps + p.groups.reduce((sum, g, i) => sum + groupRounds(g, round) * p.groupReps[i], 0)

/** Total after `rounds` complete rounds, plus sub-block rounds and extra reps done in the next one. */
export function totalReps(p: RepPlan, rounds: number, subRounds: number[], extra: number): number {
  let total = 0
  for (let r = 1; r <= rounds; r++) total += roundReps(p, r)
  return total + subRounds.reduce((sum, n, i) => sum + n * (p.groupReps[i] ?? 0), 0) + extra
}
