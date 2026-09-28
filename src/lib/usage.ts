// Sends usage counters (fire-and-forget; failures are ignored). Started once a member is signed in.
import { isNewSession, routeKey } from '../domain/usage'
import { isStandalone } from './install'
import { network, supabase } from './supabase'

const MAX_ERRORS = 5 // per page load, so a crash loop cannot flood the counters

let started = false
let lastView = ''
let hiddenAt: number | null = null
let errors = 0
let timeLoad = true

/** A sign-in or onboarding screen was shown: time to the app is no longer a load time. */
export function skipLoadTiming() {
  timeLoad = false
}

const track = (kind: 'session' | 'view' | 'load' | 'error', key = '', ms?: number) => {
  supabase.rpc('track_usage', { p_kind: kind, p_key: key, p_ms: ms }).then(
    () => {},
    () => {},
  )
}

const startSession = () => track('session', isStandalone() ? 'standalone' : 'browser')

function trackError(message: string) {
  if (errors++ >= MAX_ERRORS) return
  track('error', message.slice(0, 120))
}

/** Call once the signed-in member sees the app. */
export function startUsageTracking() {
  if (started) return
  started = true
  startSession()
  if (timeLoad) track('load', '', Math.round(performance.now()))

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
    } else {
      if (isNewSession(hiddenAt, Date.now())) {
        startSession()
        lastView = '' // the screen shown on return counts as a view
        trackView(location.pathname)
      }
      hiddenAt = null
    }
  })
  window.addEventListener('error', (e) => trackError(e.message || 'Erreur inconnue'))
  window.addEventListener('unhandledrejection', (e) => trackError(String(e.reason?.message ?? e.reason ?? 'Promesse rejetée')))
}

const SETTLE_POLL_MS = 100
const SETTLE_MAX_MS = 20_000
let pendingView: { key: string; timer: ReturnType<typeof setInterval> } | null = null

/**
 * Counts a screen view once its data has loaded: the view's time is from navigation until no request is in flight
 * (0 when the screen needs no request). Leaving the screen before that drops the view's timing, not the view.
 */
export function trackView(pathname: string) {
  const key = routeKey(pathname)
  if (key === lastView) return
  lastView = key
  if (pendingView) {
    clearInterval(pendingView.timer)
    track('view', pendingView.key)
  }
  const start = performance.now()
  const timer = setInterval(() => {
    const loading = network.inFlight > 0
    if (loading && performance.now() - start < SETTLE_MAX_MS) return
    clearInterval(timer)
    pendingView = null
    track('view', key, loading ? undefined : Math.round(Math.max(0, network.lastEnd - start)))
  }, SETTLE_POLL_MS)
  pendingView = { key, timer }
}
