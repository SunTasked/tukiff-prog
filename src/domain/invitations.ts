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

export type InvitationValidity = 'single' | 'day'

const DAY_MS = 24 * 60 * 60 * 1000

/** single: one account, valid 7 days. day: unlimited accounts for 24 h. */
export function invitationValues(validity: InvitationValidity, now = new Date()) {
  return validity === 'single'
    ? { max_uses: 1, expires_at: new Date(now.getTime() + 7 * DAY_MS).toISOString() }
    : { max_uses: null, expires_at: new Date(now.getTime() + DAY_MS).toISOString() }
}
