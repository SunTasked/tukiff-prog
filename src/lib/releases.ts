import { visibleReleases, hasUnread, type Release } from '../domain/releases'
import { supabase, type Profile } from './supabase'
import { isAdmin, isCoach } from '../features/auth/AuthProvider'

// Bundled at build time: a new version of the app ships its own notes, so the service worker reload brings them.
const files = import.meta.glob<Release>('../../releases/v*.json', { eager: true, import: 'default' })
export const RELEASES = Object.values(files)

const viewer = (p: Profile | null) => ({ coach: isCoach(p), admin: isAdmin(p) })

export const releasesFor = (p: Profile | null) => visibleReleases(RELEASES, viewer(p))

/** The last version read is kept on the profile (messages_seen) so it follows the user across devices. */
export const unreadMessages = (p: Profile | null) =>
  hasUnread(releasesFor(p), RELEASES.map((r) => r.version), p?.messages_seen ?? null)

/** Marks every release as read (the newest version, whoever it is for). Returns whether the profile changed. */
export async function markMessagesRead(p: Profile | null): Promise<boolean> {
  const newest = visibleReleases(RELEASES, { coach: true, admin: true })[0]
  if (!p || !newest || p.messages_seen === newest.version) return false
  const { error } = await supabase.from('profiles').update({ messages_seen: newest.version }).eq('id', p.id)
  return !error
}
