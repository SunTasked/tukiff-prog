import { describe, expect, it } from 'vitest'
import { invitationStatus, invitationUrl, invitationValues, isPermanent } from './invitations'

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

describe('invitationValues', () => {
  it('single use lasts 7 days', () => {
    expect(invitationValues('single', now)).toEqual({ max_uses: 1, expires_at: '2026-01-17T12:00:00.000Z' })
  })
  it('permanent link is unlimited and never expires', () => {
    const values = invitationValues('permanent', now)
    expect(values).toEqual({ max_uses: null, expires_at: '9999-12-31T00:00:00.000Z' })
    expect(isPermanent(values)).toBe(true)
    expect(invitationStatus({ ...values, revoked_at: null, uses: 300 }, now)).toBe('active')
  })
  it('detects non-permanent links', () => {
    expect(isPermanent(invitationValues('single', now))).toBe(false)
  })
})
