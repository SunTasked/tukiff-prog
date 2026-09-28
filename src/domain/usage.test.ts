import { describe, expect, it } from 'vitest'
import { isDormant, isNewSession, lastActivityLabel, pageLabel, routeKey, SESSION_GAP_MS } from './usage'

describe('routeKey', () => {
  it('replaces ids by :id', () => {
    expect(routeKey('/library/workouts/6528c25d-390d-4b84-9066-7105b161c011/edit')).toBe('/library/workouts/:id/edit')
    expect(routeKey('/workouts/6528C25D-390D-4B84-9066-7105B161C011')).toBe('/workouts/:id')
  })
  it('normalizes root and trailing slashes', () => {
    expect(routeKey('/')).toBe('/')
    expect(routeKey('/records/')).toBe('/records')
  })
})

describe('isNewSession', () => {
  it('needs 30 min in the background', () => {
    expect(isNewSession(null, 1e9)).toBe(false)
    expect(isNewSession(0, SESSION_GAP_MS - 1)).toBe(false)
    expect(isNewSession(0, SESSION_GAP_MS)).toBe(true)
  })
})

describe('labels', () => {
  const now = new Date('2026-09-28T10:00:00')
  it('names known pages and keeps unknown keys', () => {
    expect(pageLabel('/calendar')).toBe('Planning')
    expect(pageLabel('/other')).toBe('/other')
  })
  it('describes the last activity in calendar days', () => {
    expect(lastActivityLabel(null, now)).toBe('Jamais')
    expect(lastActivityLabel('2026-09-28T08:00:00', now)).toBe('Aujourd’hui')
    expect(lastActivityLabel('2026-09-27T23:00:00', now)).toBe('Hier')
    expect(lastActivityLabel('2026-09-20T12:00:00', now)).toBe('Il y a 8 j')
  })
  it('flags members inactive for 14 days', () => {
    expect(isDormant(null, now)).toBe(true)
    expect(isDormant('2026-09-20T10:00:00', now)).toBe(false)
    expect(isDormant('2026-09-14T10:00:00', now)).toBe(true)
  })
})
