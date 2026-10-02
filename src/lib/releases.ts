import { visibleReleases, hasUnread, type Release } from '../domain/releases'
import { getItem, setItem } from './storage'

// Bundled at build time: a new version of the app ships its own notes, so the service worker reload brings them.
const files = import.meta.glob<Release>('../../releases/v*.json', { eager: true, import: 'default' })
export const RELEASES = Object.values(files)

const SEEN_KEY = 'messagesSeen'

export const releasesFor = (viewer: { coach: boolean; admin: boolean }) => visibleReleases(RELEASES, viewer)

export function unreadMessages(viewer: { coach: boolean; admin: boolean }) {
  return hasUnread(releasesFor(viewer), RELEASES.map((r) => r.version), getItem(SEEN_KEY))
}

/** Marks every release as read (the newest version, whoever it is for). */
export function markMessagesRead() {
  const newest = releasesFor({ coach: true, admin: true })[0]
  if (newest) setItem(SEEN_KEY, newest.version)
}
