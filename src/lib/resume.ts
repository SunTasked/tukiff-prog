import { useEffect, useRef } from 'react'

/** Minimum time in the background before a return counts as a "resume" (skips quick app switches). */
const MIN_HIDDEN_MS = 30_000

type Listener = () => void
const listeners = new Set<Listener>()
let hiddenAt: number | null = null

// iOS keeps a standalone PWA alive for days: without this, screens keep the data loaded at launch.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now()
    return
  }
  const away = hiddenAt === null ? 0 : Date.now() - hiddenAt
  hiddenAt = null
  if (away >= MIN_HIDDEN_MS) listeners.forEach((l) => l())
})

/** Calls `fn` when the app comes back to the foreground after a while in the background. */
export function onResume(fn: Listener) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** Hook version of onResume: always calls the latest `fn`. */
export function useOnResume(fn: Listener) {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  useEffect(() => onResume(() => ref.current()), [])
}
