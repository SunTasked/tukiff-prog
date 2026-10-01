import { describe, expect, it } from 'vitest'
import { normalizeLink } from './sponsors'

describe('normalizeLink', () => {
  it('adds https when missing, keeps full links, empty = none', () => {
    expect(normalizeLink(' kanda-fitness.fr ')).toBe('https://kanda-fitness.fr')
    expect(normalizeLink('http://a.fr/x')).toBe('http://a.fr/x')
    expect(normalizeLink('  ')).toBeNull()
  })
})
