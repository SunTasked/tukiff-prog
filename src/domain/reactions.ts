/** The faces offered by "+" (club choice). */
export const REACTION_EMOJIS = ['😬', '😘', '🫠', '😏', '😭']

/** Emojis used, most used first (ties: first used first). */
export function reactionCounts(emojis: string[]): { emoji: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const e of emojis) counts.set(e, (counts.get(e) ?? 0) + 1)
  return [...counts].map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count)
}
