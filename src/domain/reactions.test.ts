import { expect, it } from 'vitest'
import { firstEmoji, reactionCounts } from './reactions'

it('keeps the first emoji only, including multi-codepoint ones', () => {
  expect(firstEmoji(' 🔥🔥 ')).toBe('🔥')
  expect(firstEmoji('👍🏽ok')).toBe('👍🏽')
  expect(firstEmoji('🏋️‍♀️')).toBe('🏋️‍♀️')
  expect(firstEmoji('  ')).toBeNull()
})

it('counts emojis, most used first', () => {
  expect(reactionCounts(['😭', '🔥', '💪', '🔥'])).toEqual([
    { emoji: '🔥', count: 2 },
    { emoji: '😭', count: 1 },
    { emoji: '💪', count: 1 },
  ])
})
