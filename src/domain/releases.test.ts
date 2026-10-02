import { describe, expect, it } from 'vitest'
import { compareVersions, hasUnread, isUnread, readBaseline, visibleReleases, type Release } from './releases'

const releases: Release[] = [
  { version: '1.0.0', date: '2026-10-02', athlete: ['Séance du jour'], coach: ['Éditeur'] },
  { version: '1.10.0', date: '2026-10-20', admin: ['Technique'] },
  { version: '1.2.0', date: '2026-10-09', athlete: ['Claps'], admin: ['RLS'] },
]
const athlete = { coach: false, admin: false }

describe('compareVersions', () => {
  it('compares numerically, not as text', () => {
    expect(compareVersions('1.10.0', '1.2.0')).toBeGreaterThan(0)
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0)
    expect(compareVersions('0.9.9', '1.0.0')).toBeLessThan(0)
  })
})

describe('visibleReleases', () => {
  it('sorts newest first and keeps only the notes for the viewer', () => {
    expect(visibleReleases(releases, athlete).map((r) => [r.version, r.notes.map((n) => n.text)])).toEqual([
      ['1.2.0', ['Claps']],
      ['1.0.0', ['Séance du jour']],
    ])
  })

  it('adds coach and admin notes after the athlete ones', () => {
    const all = visibleReleases(releases, { coach: true, admin: true })
    expect(all.map((r) => r.version)).toEqual(['1.10.0', '1.2.0', '1.0.0'])
    expect(all[2].notes).toEqual([
      { audience: 'athlete', text: 'Séance du jour' },
      { audience: 'coach', text: 'Éditeur' },
    ])
  })
})

describe('hasUnread', () => {
  const all = releases.map((r) => r.version)
  const visible = visibleReleases(releases, athlete)

  it('is unread when the newest visible release is newer than the last seen', () => {
    expect(hasUnread(visible, all, '1.0.0')).toBe(true)
    expect(hasUnread(visible, all, '1.2.0')).toBe(false)
  })

  it('ignores newer releases the viewer cannot see', () => {
    expect(hasUnread(visible, all, '1.2.0')).toBe(false)
  })

  it('without anything seen, only the newest release counts', () => {
    expect(hasUnread(visible, all, null)).toBe(false) // newest (1.10.0) is admin only
    expect(hasUnread(visibleReleases(releases, { coach: false, admin: true }), all, null)).toBe(true)
    expect(hasUnread([{ version: '1.0.0' }], ['1.0.0'], null)).toBe(true)
    expect(hasUnread([], all, null)).toBe(false)
  })
})

describe('isUnread', () => {
  it('opens releases newer than the last seen, and only the newest when nothing was seen', () => {
    const all = releases.map((r) => r.version)
    expect(isUnread('1.2.0', readBaseline(all, '1.0.0'))).toBe(true)
    expect(isUnread('1.0.0', readBaseline(all, '1.0.0'))).toBe(false)
    expect(isUnread('1.10.0', readBaseline(all, null))).toBe(true)
    expect(isUnread('1.2.0', readBaseline(all, null))).toBe(false)
    expect(isUnread('1.0.0', readBaseline(['1.0.0'], null))).toBe(true)
  })
})
