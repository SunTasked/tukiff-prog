import { describe, expect, it } from 'vitest'
import { installHint } from './install'

const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1'
const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36'
const desktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36'

describe('installHint', () => {
  it('shows nothing inside the installed app', () => {
    expect(installHint({ standalone: true, userAgent: iphone, canPrompt: false })).toBe('none')
    expect(installHint({ standalone: true, userAgent: android, canPrompt: true })).toBe('none')
  })
  it('explains the share menu on iOS', () => {
    expect(installHint({ standalone: false, userAgent: iphone, canPrompt: false })).toBe('ios')
  })
  it('uses the native prompt when available', () => {
    expect(installHint({ standalone: false, userAgent: android, canPrompt: true })).toBe('android-prompt')
  })
  it('falls back to manual instructions on Android', () => {
    expect(installHint({ standalone: false, userAgent: android, canPrompt: false })).toBe('android-manual')
  })
  it('shows nothing on desktop', () => {
    expect(installHint({ standalone: false, userAgent: desktop, canPrompt: false })).toBe('none')
  })
})
