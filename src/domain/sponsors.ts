/** "kanda-fitness.fr" → "https://kanda-fitness.fr"; empty → null. */
export function normalizeLink(link: string): string | null {
  const t = link.trim()
  if (!t) return null
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}
