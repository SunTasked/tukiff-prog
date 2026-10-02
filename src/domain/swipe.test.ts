import { describe, expect, it } from 'vitest'
import { swipeAxis, swipeCommits } from './swipe'

describe('swipeAxis', () => {
  it('waits for the finger to move', () => {
    expect(swipeAxis(4, 3)).toBeNull()
  })
  it('locks horizontal only on clearly sideways moves', () => {
    expect(swipeAxis(-30, 5)).toBe('x')
    expect(swipeAxis(20, 20)).toBe('y')
    expect(swipeAxis(2, -40)).toBe('y')
  })
})

describe('swipeCommits', () => {
  it('turns the page past 30% of the width', () => {
    expect(swipeCommits(-130, 0, 390)).toBe(true)
    expect(swipeCommits(100, 0, 390)).toBe(false)
  })
  it('turns the page on a quick flick in the same direction', () => {
    expect(swipeCommits(60, 0.8, 390)).toBe(true)
    expect(swipeCommits(60, -0.8, 390)).toBe(false)
    expect(swipeCommits(20, 1, 390)).toBe(false)
  })
})
