// Release notes (releases/v*.json) shown on the Messages page, filtered by what the viewer is.

export type Audience = 'athlete' | 'coach' | 'admin'
export type Release = { version: string; date: string } & Partial<Record<Audience, string[]>>
export type ReleaseNote = { audience: Audience; text: string }

/** Negative when a < b, for "1.10.0" style versions. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

/** Releases newest first, each with the notes this viewer can see; releases with none are left out. */
export function visibleReleases(releases: Release[], viewer: { coach: boolean; admin: boolean }) {
  const audiences: Audience[] = ['athlete', ...(viewer.coach ? (['coach'] as const) : []), ...(viewer.admin ? (['admin'] as const) : [])]
  return [...releases]
    .sort((a, b) => compareVersions(b.version, a.version))
    .map((r) => ({ ...r, notes: audiences.flatMap((audience) => (r[audience] ?? []).map((text) => ({ audience, text }))) }))
    .filter((r) => r.notes.length > 0)
}

/**
 * Whether the newest visible release is newer than the last one seen. Nothing seen yet (new device or first
 * launch with this feature): only the newest release counts as unread, not the whole history.
 */
export function hasUnread(visible: { version: string }[], allVersions: string[], seen: string | null): boolean {
  if (!visible.length) return false
  const sorted = [...allVersions].sort(compareVersions)
  const baseline = seen ?? sorted.at(-2) ?? null
  return baseline === null || compareVersions(visible[0].version, baseline) > 0
}
