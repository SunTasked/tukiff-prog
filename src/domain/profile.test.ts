import { describe, expect, it } from 'vitest'
import { initials } from './profile'

describe('initials', () => {
  it('takes the first letters of up to two words', () => {
    expect(initials('Jean Dupont')).toBe('JD')
    expect(initials('jean.dupont')).toBe('JD')
    expect(initials('gkheng')).toBe('GK')
    expect(initials('  ')).toBe('?')
    expect(initials(null)).toBe('?')
  })
})
