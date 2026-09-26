import { describe, expect, it } from 'vitest'
import { invitationStatus, invitationUrl } from './invitations'

const now = new Date('2026-01-10T12:00:00Z')
const base = { expires_at: '2026-01-17T12:00:00Z', revoked_at: null, max_uses: null, uses: 0 }

describe('invitationStatus', () => {
  it('is active when valid and unlimited', () => {
    expect(invitationStatus({ ...base, uses: 12 }, now)).toBe('active')
  })
  it('is revoked first', () => {
    expect(invitationStatus({ ...base, revoked_at: '2026-01-09T00:00:00Z', expires_at: '2026-01-01T00:00:00Z' }, now)).toBe('revoked')
  })
  it('is expired at the expiry instant', () => {
    expect(invitationStatus({ ...base, expires_at: now.toISOString() }, now)).toBe('expired')
  })
  it('is used when max uses reached', () => {
    expect(invitationStatus({ ...base, max_uses: 1, uses: 1 }, now)).toBe('used')
    expect(invitationStatus({ ...base, max_uses: 2, uses: 1 }, now)).toBe('active')
  })
})

it('builds the join url', () => {
  expect(invitationUrl('https://x.app', 'abc')).toBe('https://x.app/join/abc')
})
