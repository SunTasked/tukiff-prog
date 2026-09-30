import { describe, expect, it } from 'vitest'
import { fullName, initials, isPending, scoreName, shortName } from './profile'

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
  const noNick = { display_name: null, first_name: 'Guillaume', last_name: 'kheng' }
  it('full name for coaches, nickname as fallback', () => {
    expect(fullName(p)).toBe('Guillaume kheng')
    expect(fullName({ display_name: 'gkheng', first_name: null, last_name: null })).toBe('gkheng')
    expect(fullName(null)).toBe('—')
  })
  it('first name + initial', () => {
    expect(shortName(p)).toBe('Guillaume K.')
    expect(shortName({ first_name: 'Guillaume', last_name: null })).toBe('Guillaume')
    expect(shortName({ display_name: 'gkheng' })).toBe('gkheng')
  })
  it('scores: nickname first, else first name + initial', () => {
    expect(scoreName(p)).toBe('gkheng')
    expect(scoreName(noNick)).toBe('Guillaume K.')
  })
  it('pending sign-up: no name and no nickname', () => {
    expect(isPending({ display_name: null, first_name: null })).toBe(true)
    expect(isPending(noNick)).toBe(false)
    expect(isPending({ display_name: 'old', first_name: null })).toBe(false)
  })
})
