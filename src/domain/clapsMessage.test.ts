import { describe, expect, it } from 'vitest'
import { clapsMessage } from './clapsMessage'

const list = [
  { text: 'Grosse machine va', text_female: null },
  { text: 'Ok monsieur', text_female: 'Ok madame' },
]

describe('clapsMessage', () => {
  it('agrees with the count and ends with a clap and a compliment', () => {
    expect(clapsMessage(3, list, 'male', () => 0)).toBe('3 athlètes ont clappé ta perf pendant ta récup 👏 (Grosse machine va)')
    expect(clapsMessage(1, list, 'male', () => 0)).toBe('1 athlète a clappé ta perf pendant ta récup 👏 (Grosse machine va)')
  })

  it('uses the women’s version of the compliment when there is one', () => {
    expect(clapsMessage(2, list, 'female', () => 0.99)).toBe('2 athlètes ont clappé ta perf pendant ta récup 👏 (Ok madame)')
    expect(clapsMessage(2, list, 'female', () => 0)).toBe('2 athlètes ont clappé ta perf pendant ta récup 👏 (Grosse machine va)')
    expect(clapsMessage(2, list, null, () => 0.99)).toBe('2 athlètes ont clappé ta perf pendant ta récup 👏 (Ok monsieur)')
  })

  it('has no parentheses without compliments', () => {
    expect(clapsMessage(2, [], 'male')).toBe('2 athlètes ont clappé ta perf pendant ta récup 👏')
  })
})
