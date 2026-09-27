// Workout timer as a pure function of elapsed time: no drift, robust to the app being backgrounded.
import type { Format, FormatParams } from './workout'

export type TimerConfig =
  | { mode: 'for_time'; cap_s: number | null }
  | { mode: 'amrap'; duration_s: number }
  | { mode: 'emom'; interval_s: number; rounds: number }
  | { mode: 'tabata'; work_s: number; rest_s: number; rounds: number }

export type TimerMode = TimerConfig['mode']
export const TIMER_MODES: Record<TimerMode, string> = { for_time: 'For Time', amrap: 'AMRAP', emom: 'EMOM', tabata: 'Tabata' }

export const COUNTDOWN_S = 10

export type TimerState = {
  phase: 'countdown' | 'work' | 'rest' | 'done'
  /** Seconds to display: counting up for For Time, remaining otherwise. */
  display_s: number
  counting: 'up' | 'down'
  round: number | null
  rounds: number | null
  /** 0..1 progress of the whole workout (null when unbounded). */
  progress: number | null
}

export function totalDuration(c: TimerConfig): number | null {
  switch (c.mode) {
    case 'for_time':
      return c.cap_s
    case 'amrap':
      return c.duration_s
    case 'emom':
      return c.interval_s * c.rounds
    case 'tabata':
      return (c.work_s + c.rest_s) * c.rounds - c.rest_s // no rest after the last round
  }
}

export function timerState(c: TimerConfig, elapsedMs: number): TimerState {
  const e = elapsedMs / 1000
  const base = { round: null, rounds: null, progress: null }
  if (e < COUNTDOWN_S) return { ...base, phase: 'countdown', display_s: Math.ceil(COUNTDOWN_S - e), counting: 'down' }

  const t = e - COUNTDOWN_S
  const total = totalDuration(c)
  const progress = total ? Math.min(1, t / total) : null
  if (total !== null && t >= total) {
    return {
      phase: 'done',
      display_s: c.mode === 'for_time' ? total : 0,
      counting: c.mode === 'for_time' ? 'up' : 'down',
      round: 'rounds' in c ? c.rounds : null,
      rounds: 'rounds' in c ? c.rounds : null,
      progress: 1,
    }
  }

  switch (c.mode) {
    case 'for_time':
      return { ...base, phase: 'work', display_s: Math.floor(t), counting: 'up', progress }
    case 'amrap':
      return { ...base, phase: 'work', display_s: Math.ceil(c.duration_s - t), counting: 'down', progress }
    case 'emom': {
      const inInterval = t % c.interval_s
      return {
        phase: 'work',
        display_s: Math.ceil(c.interval_s - inInterval),
        counting: 'down',
        round: Math.floor(t / c.interval_s) + 1,
        rounds: c.rounds,
        progress,
      }
    }
    case 'tabata': {
      const cycle = c.work_s + c.rest_s
      const inCycle = t % cycle
      const work = inCycle < c.work_s
      return {
        phase: work ? 'work' : 'rest',
        display_s: Math.ceil(work ? c.work_s - inCycle : cycle - inCycle),
        counting: 'down',
        round: Math.floor(t / cycle) + 1,
        rounds: c.rounds,
        progress,
      }
    }
  }
}

export type Cue = 'start' | 'tick' | 'end' | null

/** Sound to play when moving from prev to next state (called on each frame). */
export function cue(prev: TimerState | null, next: TimerState): Cue {
  if (!prev) return null
  if (next.phase === 'done' && prev.phase !== 'done') return 'end'
  if (next.phase !== prev.phase || next.round !== prev.round) return 'start'
  if (next.counting === 'down' && next.display_s !== prev.display_s && next.display_s <= 3 && next.display_s >= 1)
    return 'tick'
  return null
}

/** Timer settings from a workout block; null if the format has no timer. */
export function timerFromBlock(format: Format, p: FormatParams): TimerConfig | null {
  switch (format) {
    case 'for_time':
      return { mode: 'for_time', cap_s: p.time_cap_s ?? null }
    case 'amrap':
      return { mode: 'amrap', duration_s: p.duration_s ?? 12 * 60 }
    case 'emom':
      return { mode: 'emom', interval_s: p.interval_s ?? 60, rounds: p.rounds ?? 10 }
    case 'tabata':
      return { mode: 'tabata', work_s: p.work_s ?? 20, rest_s: p.rest_s ?? 10, rounds: p.rounds ?? 8 }
    default:
      return null
  }
}

export function defaultTimer(mode: TimerMode): TimerConfig {
  return timerFromBlock(mode, {})!
}

// URL (de)serialization: /timer?mode=emom&interval=60&rounds=10
export function timerToParams(c: TimerConfig): Record<string, string> {
  const { mode, ...rest } = c
  return Object.fromEntries([['mode', mode], ...Object.entries(rest).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])])
}

export function timerFromParams(p: URLSearchParams): TimerConfig | null {
  const mode = p.get('mode') as TimerMode | null
  if (!mode || !(mode in TIMER_MODES)) return null
  const n = (k: string) => (p.get(k) != null && Number.isFinite(Number(p.get(k))) ? Number(p.get(k)) : undefined)
  const d = defaultTimer(mode)
  switch (mode) {
    case 'for_time':
      return { mode, cap_s: n('cap_s') ?? null }
    case 'amrap':
      return { mode, duration_s: n('duration_s') ?? (d as { duration_s: number }).duration_s }
    case 'emom':
      return { mode, interval_s: n('interval_s') ?? 60, rounds: n('rounds') ?? 10 }
    case 'tabata':
      return { mode, work_s: n('work_s') ?? 20, rest_s: n('rest_s') ?? 10, rounds: n('rounds') ?? 8 }
  }
}
