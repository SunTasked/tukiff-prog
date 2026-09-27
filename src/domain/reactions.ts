export const DEFAULT_EMOJIS = ['😬', '😘', '🫠', '😏', '😭']

/** First grapheme of the input (a pasted or typed emoji), or null if empty. */
export function firstEmoji(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  const [first] = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)
  return first?.segment ?? null
}

/** Default emojis first (even at 0), then the others by count. */
export function reactionCounts(emojis: string[]): { emoji: string; count: number }[] {
  const counts = new Map<string, number>(DEFAULT_EMOJIS.map((e) => [e, 0]))
  for (const e of emojis) counts.set(e, (counts.get(e) ?? 0) + 1)
  const extra = [...counts].filter(([e]) => !DEFAULT_EMOJIS.includes(e)).sort((a, b) => b[1] - a[1])
  return [...DEFAULT_EMOJIS.map((e) => [e, counts.get(e)!] as const), ...extra].map(([emoji, count]) => ({ emoji, count }))
}
