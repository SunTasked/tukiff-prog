export type InstallHint = 'none' | 'ios' | 'android-prompt' | 'android-manual'

/** Which "install the app" hint to show, if any. */
export function installHint(opts: { standalone: boolean; userAgent: string; canPrompt: boolean }): InstallHint {
  if (opts.standalone) return 'none'
  if (opts.canPrompt) return 'android-prompt'
  if (/iPhone|iPad|iPod/.test(opts.userAgent)) return 'ios'
  if (/Android/.test(opts.userAgent)) return 'android-manual'
  return 'none' // desktop
}
