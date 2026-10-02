import { describe, expect, it } from 'vitest'
import { clapsMessage } from './clapsMessage'

describe('clapsMessage', () => {
  it('agrees with the count and ends with a clap and a compliment', () => {
    expect(clapsMessage(3, () => 0)).toBe('Depuis ta dernière visite, 3 athlètes ont salué tes performances 👏 (grosse machine)')
    expect(clapsMessage(1, () => 0)).toBe('Depuis ta dernière visite, 1 athlète a salué tes performances 👏 (grosse machine)')
  })

  it('draws the phrase and the compliment at random', () => {
    expect(clapsMessage(1, () => 0.99)).toBe('1 athlète est passé applaudir tes scores 👏 (rien ne t’arrête)')
  })
})
