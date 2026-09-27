// Score types, formatting and leaderboard ranking. Levels are never mixed: rank within one level.
import { LEVELS, formatDuration, type Format, type Level } from './workout'

export type ScoreType = 'time' | 'rounds_reps' | 'load' | 'reps' | 'none'

export function scoreType(format: Format): ScoreType {
  switch (format) {
    case 'for_time':
      return 'time'
    case 'amrap':
      return 'rounds_reps'
    case 'sets_reps':
      return 'load'
    case 'tabata':
      return 'reps'
    case 'emom':
    case 'none':
      return 'none'
  }
}

export type Score = {
  time_s: number | null
  capped: boolean
  rounds: number | null
  reps: number | null
  load_kg: number | null
}

export const emptyScore = (): Score => ({ time_s: null, capped: false, rounds: null, reps: null, load_kg: null })

/** Keeps only the fields relevant to the score type (the others are stored as null). */
export function normalizeScore(type: ScoreType, s: Score): Score {
  const out = emptyScore()
  if (type === 'time') {
    if (s.capped) Object.assign(out, { capped: true, reps: s.reps })
    else out.time_s = s.time_s
  } else if (type === 'rounds_reps') Object.assign(out, { rounds: s.rounds, reps: s.reps ?? 0 })
  else if (type === 'load') out.load_kg = s.load_kg
  else if (type === 'reps') out.reps = s.reps
  return out
}

export function validateScore(type: ScoreType, s: Score): string | null {
  switch (type) {
    case 'time':
      if (s.capped) return s.reps == null ? 'Indique le nombre de reps faites au cap.' : null
      return s.time_s == null || s.time_s <= 0 ? 'Indique ton temps (mm:ss).' : null
    case 'rounds_reps':
      return s.rounds == null ? 'Indique le nombre de rounds.' : null
    case 'load':
      return s.load_kg == null ? 'Indique la charge.' : null
    case 'reps':
      return s.reps == null ? 'Indique le nombre de reps.' : null
    case 'none':
      return null
  }
}

export function formatScore(type: ScoreType, s: Score): string {
  const n = (v: number) => String(v).replace('.', ',')
  switch (type) {
    case 'time':
      if (s.capped) return `CAP + ${s.reps ?? 0} reps`
      return s.time_s != null ? formatDuration(s.time_s) : '—'
    case 'rounds_reps':
      return s.rounds != null ? `${s.rounds} rds${s.reps ? ` + ${s.reps}` : ''}` : '—'
    case 'load':
      return s.load_kg != null ? `${n(s.load_kg)} kg` : '—'
    case 'reps':
      return s.reps != null ? `${s.reps} reps` : '—'
    case 'none':
      return 'Fait'
  }
}

const desc = (a: number | null, b: number | null) => (b ?? -1) - (a ?? -1)
const asc = (a: number | null, b: number | null) => (a ?? Infinity) - (b ?? Infinity)

/** < 0 when a ranks before b. Missing values rank last. */
export function compareScores(type: ScoreType, a: Score, b: Score): number {
  switch (type) {
    case 'time':
      // Finishers (by time) before capped athletes (by reps done).
      if (a.capped !== b.capped) return a.capped ? 1 : -1
      return a.capped ? desc(a.reps, b.reps) : asc(a.time_s, b.time_s)
    case 'rounds_reps':
      return desc(a.rounds, b.rounds) || desc(a.reps, b.reps)
    case 'load':
      return desc(a.load_kg, b.load_kg)
    case 'reps':
      return desc(a.reps, b.reps)
    case 'none':
      return 0
  }
}

/** Sorted with competition ranking: ties share a rank (1, 2, 2, 4). */
export function rankResults<T extends Score>(type: ScoreType, list: T[]): { result: T; rank: number }[] {
  const sorted = [...list].sort((a, b) => compareScores(type, a, b))
  return sorted.map((result, i) => {
    let rank = i + 1
    while (rank > 1 && compareScores(type, sorted[rank - 2], result) === 0) rank--
    return { result, rank }
  })
}

/** One leaderboard per level, in LEVELS order, skipping empty levels. */
export function leaderboards<T extends Score & { level: string }>(type: ScoreType, list: T[]) {
  return (Object.keys(LEVELS) as Level[])
    .map((level) => ({ level, rows: rankResults(type, list.filter((r) => r.level === level)) }))
    .filter((b) => b.rows.length > 0)
}
