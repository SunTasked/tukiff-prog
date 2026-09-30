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

type Names = { display_name?: string | null; first_name?: string | null; last_name?: string | null } | null | undefined

/** "Prénom Nom" (member page), nickname when names are missing. */
export function fullName(p: Names): string {
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
  return name || p?.display_name || '—'
}

/** "Prénom N." (scores, leaderboards), nickname when names are missing. */
export function scoreName(p: Names): string {
  if (!p?.first_name) return p?.display_name || '—'
  return p.last_name ? `${p.first_name} ${p.last_name[0].toUpperCase()}.` : p.first_name
}
