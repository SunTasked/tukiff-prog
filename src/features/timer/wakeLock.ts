// Keeps the screen on while the timer runs (Screen Wake Lock API, iOS 16.4+).
let lock: WakeLockSentinel | null = null
let wanted = false

async function acquire() {
  try {
    lock = await navigator.wakeLock?.request('screen')
  } catch {
    lock = null // unsupported or refused: the timer still works
  }
}

// The lock is released when the page is hidden: take it back when visible again.
document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible') acquire()
})

export function keepAwake(on: boolean) {
  wanted = on
  if (on) acquire()
  else {
    lock?.release()
    lock = null
  }
}
