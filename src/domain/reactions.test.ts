import { expect, it } from 'vitest'
import { firstEmoji, reactionCounts } from './reactions'

it('keeps the first emoji only, including multi-codepoint ones', () => {
  expect(firstEmoji(' 🔥🔥 ')).toBe('🔥')
  expect(firstEmoji('👍🏽ok')).toBe('👍🏽')
  expect(firstEmoji('🏋️‍♀️')).toBe('🏋️‍♀️')
  expect(firstEmoji('  ')).toBeNull()
})

it('lists defaults first, then other emojis by count', () => {
  const r = reactionCounts(['🔥', '😭', '💪', '🔥'])
  expect(r.slice(0, 5).map((x) => `${x.emoji}${x.count}`)).toEqual(['😬0', '😘0', '🫠0', '😏0', '😭1'])
  expect(r.slice(5)).toEqual([{ emoji: '🔥', count: 2 }, { emoji: '💪', count: 1 }])
})
