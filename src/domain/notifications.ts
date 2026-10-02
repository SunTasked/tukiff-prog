// Notification preferences (profiles.notifications): opt-outs only, a missing key means on.

export const NOTIFICATION_CATEGORIES = [
  { key: 'updates', label: 'Mises à jour de l’app', hint: 'Point rouge sur la cloche' },
  { key: 'claps', label: 'Claps 👏 reçus', hint: 'Nombre d’athlètes qui ont salué tes scores' },
] as const

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]['key']
export type NotificationPrefs = Partial<Record<NotificationCategory | 'all', boolean>>

export const asPrefs = (value: unknown): NotificationPrefs =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as NotificationPrefs) : {}

/** Whether a category is on: the global switch and the category itself must both be on. */
export const notificationOn = (prefs: NotificationPrefs, category: NotificationCategory) =>
  prefs.all !== false && prefs[category] !== false
