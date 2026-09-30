import { describe, expect, it } from 'vitest'
import { fullName, initials, scoreName } from './profile'

describe('initials', () => {
  it('takes the first letters of up to two words', () => {
    expect(initials('Jean Dupont')).toBe('JD')
    expect(initials('jean.dupont')).toBe('JD')
    expect(initials('gkheng')).toBe('GK')
    expect(initials('  ')).toBe('?')
    expect(initials(null)).toBe('?')
  })
})

describe('names', () => {
  const p = { display_name: 'gkheng', first_name: 'Guillaume', last_name: 'kheng' }
  it('full name on the member page', () => {
    expect(fullName(p)).toBe('Guillaume kheng')
    expect(fullName({ display_name: 'gkheng', first_name: null, last_name: null })).toBe('gkheng')
    expect(fullName(null)).toBe('—')
  })
  it('first name + initial in scores', () => {
    expect(scoreName(p)).toBe('Guillaume K.')
    expect(scoreName({ display_name: 'gkheng', first_name: 'Guillaume', last_name: null })).toBe('Guillaume')
    expect(scoreName({ display_name: 'gkheng' })).toBe('gkheng')
  })
})
