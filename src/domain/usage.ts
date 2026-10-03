// Usage telemetry helpers (admin "Stats" tab). Counters are aggregated server-side (migration 0026).

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Route pattern of a path: ids become ":id" so that screens, not records, are counted. */
export function routeKey(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean).map((p) => (ID.test(p) ? ':id' : p))
  return '/' + parts.join('/')
}

/** A session starts on launch or when the app comes back after 30 min in the background. */
export const SESSION_GAP_MS = 30 * 60 * 1000
export const isNewSession = (hiddenAt: number | null, now: number) => hiddenAt !== null && now - hiddenAt >= SESSION_GAP_MS

const pages: Record<string, string> = {
  '/': 'Accueil',
  '/profile': 'Profil',
  '/workouts/:id': 'Séance (athlète)',
  '/records': 'Records',
  '/timer': 'Timer',
  '/athletes': 'Communauté',
  '/athletes/:id': 'Fiche membre',
  '/programs/:id': 'Programme',
  '/calendar': 'Planning',
  '/calendar/workouts/:id': 'Séance planifiée',
  '/library': 'Bibliothèque',
  '/library/workouts/new': 'Nouvelle séance',
  '/library/workouts/:id': 'Séance (bibliothèque)',
  '/library/workouts/:id/edit': 'Édition de séance',
  '/library/exercises/:id': 'Mouvement',
  '/admin': 'Stats',
}

export const pageLabel = (key: string) => pages[key] ?? key

/** "Aujourd’hui", "Hier", "Il y a 3 j", "Jamais". */
export function lastActivityLabel(at: string | null, now: Date): string {
  if (!at) return 'Jamais'
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round((day(now) - day(new Date(at))) / 86_400_000)
  if (days <= 0) return 'Aujourd’hui'
  if (days === 1) return 'Hier'
  return `Il y a ${days} j`
}

/** Inactive for 14 days or more (or never seen). */
export const isDormant = (at: string | null, now: Date) => !at || now.getTime() - new Date(at).getTime() >= 14 * 86_400_000
