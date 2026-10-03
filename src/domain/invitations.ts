export type InvitationLike = {
  expires_at: string
  revoked_at: string | null
  max_uses: number | null
  uses: number
}

export type InvitationStatus = 'active' | 'expired' | 'revoked' | 'used'

export function invitationStatus(inv: InvitationLike, now = new Date()): InvitationStatus {
  if (inv.revoked_at) return 'revoked'
  if (new Date(inv.expires_at) <= now) return 'expired'
  if (inv.max_uses !== null && inv.uses >= inv.max_uses) return 'used'
  return 'active'
}

export const invitationUrl = (origin: string, code: string) => `${origin}/join/${code}`

export type InvitationValidity = 'single' | 'permanent'

const DAY_MS = 24 * 60 * 60 * 1000

/** Far-future expiry of permanent links (expires_at is not null in the database). */
export const PERMANENT_EXPIRY = '9999-12-31T00:00:00.000Z'

export const isPermanent = (inv: Pick<InvitationLike, 'expires_at'>) => new Date(inv.expires_at).getUTCFullYear() >= 9999

/** single: one account, valid 7 days. permanent: unlimited accounts until revoked. */
export function invitationValues(validity: InvitationValidity, now = new Date()) {
  return validity === 'single'
    ? { max_uses: 1, expires_at: new Date(now.getTime() + 7 * DAY_MS).toISOString() }
    : { max_uses: null, expires_at: PERMANENT_EXPIRY }
}
