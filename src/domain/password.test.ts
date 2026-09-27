import { describe, expect, it } from 'vitest'
import { PASSWORD_RULES, isValidPassword } from './password'

describe('password policy', () => {
  it('accepts a compliant password', () => {
    expect(isValidPassword('Wod2026!')).toBe(true)
  })
  it.each([
    ['Wod26!', '8 caractères minimum'],
    ['WOD2026!', 'une minuscule'],
    ['wod2026!', 'une majuscule'],
    ['WodWodW!', 'un chiffre'],
    ['Wod20266', 'un caractère spécial'],
  ])('%s misses %s', (pw, rule) => {
    expect(isValidPassword(pw)).toBe(false)
    expect(PASSWORD_RULES.filter((r) => !r.test(pw)).map((r) => r.label)).toEqual([rule])
  })
  it('does not count accented capitals as uppercase (same as Supabase)', () => {
    expect(isValidPassword('Éléphant9?')).toBe(false)
    expect(isValidPassword('ÉléphanT9?')).toBe(true)
  })
})
