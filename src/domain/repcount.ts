// Reps of an AMRAP scored in total reps, from what the athlete counts: rounds done, sub-block rounds and extra reps.
import { itemRuns, type BlockDraft, type GroupDraft, type ItemDraft } from './workout'

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

/** Sub-blocks done several times in a round (ladders): counted apart, the others count as reps. */
export const isCounted = (g: GroupDraft) => (g.start ?? 1) > 1 || (g.step ?? 0) > 0

export type RepBreakdown = { rounds: number; groups: { title: string; done: number }[]; extra: number }

/**
 * Inverse of totalReps: complete rounds, then in the round in progress (movements in order) the ladder sub-block
 * rounds done and the remaining reps. null when the block cannot be counted or the total is 0.
 */
export function repBreakdown(block: BlockDraft, total: number): RepBreakdown | null {
  const plan = repPlan(block)
  if (!plan || total <= 0 || roundReps(plan, 1) <= 0) return null
  let rounds = 0
  let rem = total
  while (rem >= roundReps(plan, rounds + 1) && roundReps(plan, rounds + 1) > 0) rem -= roundReps(plan, ++rounds)
  const groups: RepBreakdown['groups'] = []
  let extra = 0
  for (const run of itemRuns(block)) {
    if (!run.items.length || rem <= 0) continue
    const g = run.group === null ? null : block.groups[run.group]
    if (g && isCounted(g) && plan.groupReps[run.group!] > 0) {
      const per = plan.groupReps[run.group!]
      const done = Math.min(Math.floor(rem / per), groupRounds(g, rounds + 1))
      groups.push({ title: g.title || 'sous-bloc', done })
      rem -= done * per
      if (done < groupRounds(g, rounds + 1)) break
    } else {
      const reps = run.items.reduce((sum, { item }) => sum + itemCount(item)!, 0) * (g ? groupRounds(g, rounds + 1) : 1)
      const n = Math.min(rem, reps)
      extra += n
      rem -= n
      if (n < reps) break
    }
  }
  return { rounds, groups: groups.filter((x) => x.done > 0), extra: extra + rem }
}

/** "4 tours + 2 DB DT + 5 reps". */
export function formatBreakdown(b: RepBreakdown): string {
  return [
    `${b.rounds} tour${b.rounds > 1 ? 's' : ''}`,
    ...b.groups.map((g) => `${g.done} ${g.title}`),
    ...(b.extra ? [`${b.extra} reps`] : []),
  ].join(' + ')
}
