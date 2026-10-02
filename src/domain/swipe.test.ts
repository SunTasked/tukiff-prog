import { describe, expect, it } from 'vitest'
import { swipeDirection } from './swipe'

describe('swipeDirection', () => {
  it('detects clear horizontal swipes', () => {
    expect(swipeDirection(-120, 10)).toBe('left')
    expect(swipeDirection(90, -20)).toBe('right')
  })
  it('ignores short moves and vertical scrolls', () => {
    expect(swipeDirection(-40, 0)).toBeNull()
    expect(swipeDirection(100, 80)).toBeNull()
    expect(swipeDirection(5, 300)).toBeNull()
  })
})
