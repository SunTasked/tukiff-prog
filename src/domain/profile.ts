// Profile helpers: gender labels and avatar initials.
export const GENDERS = { male: 'Homme', female: 'Femme' } as const
export type Gender = keyof typeof GENDERS

/** Up to two initials: "Jean Dupont" -> "JD", "gkheng" -> "GK". */
export function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/[\s._-]+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
