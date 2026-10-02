import { describe, expect, it } from 'vitest'
import { asPrefs, notificationOn } from './notifications'

describe('notificationOn', () => {
  it('is on by default, off when the category or everything is turned off', () => {
    expect(notificationOn({}, 'updates')).toBe(true)
    expect(notificationOn({ updates: false }, 'updates')).toBe(false)
    expect(notificationOn({ all: false, updates: true }, 'updates')).toBe(false)
    expect(notificationOn({ all: true }, 'updates')).toBe(true)
  })

  it('reads anything that is not an object as no preference', () => {
    expect(asPrefs(null)).toEqual({})
    expect(asPrefs([false])).toEqual({})
    expect(asPrefs({ updates: false })).toEqual({ updates: false })
  })
})
