/** Tap on the react button (Facebook "J'aime"); long press opens the picker. */
export const DEFAULT_REACTION = '👍'
export const PICKER_EMOJIS = [DEFAULT_REACTION, '😬', '😘', '🫠', '😏', '😭']

/** First grapheme of the input (a pasted or typed emoji), or null if empty. */
export function firstEmoji(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  const [first] = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)
  return first?.segment ?? null
}

/** Emojis used, most used first (ties: first used first). */
export function reactionCounts(emojis: string[]): { emoji: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const e of emojis) counts.set(e, (counts.get(e) ?? 0) + 1)
  return [...counts].map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count)
}
