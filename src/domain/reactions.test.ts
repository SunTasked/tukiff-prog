import { expect, it } from 'vitest'
import { reactionCounts } from './reactions'

it('counts emojis, most used first', () => {
  expect(reactionCounts(['😭', '🔥', '💪', '🔥'])).toEqual([
    { emoji: '🔥', count: 2 },
    { emoji: '😭', count: 1 },
    { emoji: '💪', count: 1 },
  ])
})
