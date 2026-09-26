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
