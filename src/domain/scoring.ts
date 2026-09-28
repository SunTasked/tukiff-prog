// Score types, formatting and leaderboard ranking. Levels and genders are never mixed: rank within one level.
import { GENDERS, type Gender } from './profile'
import { LEVELS, formatDuration, type Format, type FormatParams, type Level } from './workout'

export type ScoreType = 'time' | 'rounds_reps' | 'load' | 'reps' | 'none'

export const SCORE_TYPES: Record<ScoreType, string> = {
  time: 'Temps',
  rounds_reps: 'Rounds + reps',
  reps: 'Reps totales',
  load: 'Charge max',
  none: 'Aucun',
}

/** What the athlete enters, shown on the block and in the score sheet. */
export const SCORE_HINTS: Record<ScoreType, string> = {
  time: 'Ton temps final, ou les reps faites si le time cap est atteint.',
  rounds_reps: 'Les rounds complets, puis les reps faites dans le round entamé.',
  reps: 'Le total de reps faites sur tout le bloc.',
  load: 'La charge la plus lourde réussie.',
  none: 'Pas de score : indique juste que c’est fait.',
}

/** The coach's choice for the block, else the format's default. */
export function scoreType(format: Format, params: FormatParams = {}): ScoreType {
  return params.score ?? defaultScoreType(format)
}

export function defaultScoreType(format: Format): ScoreType {
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

/**
 * One leaderboard per gender (men first, skipping empty ones). Within a board, levels stay stacked in LEVELS order
 * (every elite above every RX, ...) and each row keeps its rank within its level.
 */
export function leaderboards<T extends Score & { level: string; gender: Gender | null }>(type: ScoreType, list: T[]) {
  return (Object.keys(GENDERS) as Gender[])
    .map((gender) => ({
      gender,
      rows: (Object.keys(LEVELS) as Level[]).flatMap((level) =>
        rankResults(type, list.filter((r) => r.level === level && (r.gender ?? 'male') === gender)).map((row) => ({ ...row, level })),
      ),
    }))
    .filter((b) => b.rows.length > 0)
}

/** Compact block board: the top 3 of each level (medals), plus my row when I'm further down. */
export function compactRows<R extends { level: Level; result: { athlete_id: string } }>(rows: R[], me: string | undefined): R[] {
  const seen = new Map<Level, number>()
  return rows.filter((row) => {
    const n = (seen.get(row.level) ?? 0) + 1
    seen.set(row.level, n)
    return n <= 3 || row.result.athlete_id === me
  })
}

/** Place of each row in a gender board with levels stacked: every RX comes after every elite, ties keep their rank. */
export function boardPlaces<R extends { rank: number; level: Level }>(rows: R[]): number[] {
  const firstOfLevel = new Map<Level, number>()
  rows.forEach((row, i) => {
    if (!firstOfLevel.has(row.level)) firstOfLevel.set(row.level, i)
  })
  return rows.map((row) => firstOfLevel.get(row.level)! + row.rank)
}

/**
 * Weekly leaderboard, one per gender: on each scored block of the week an athlete gets their place in the block's board
 * (levels stacked). Blocks they didn't score are ignored: the lowest average place wins, ties go to whoever scored more
 * blocks. Blocks without score, or that nobody of this gender scored, don't count.
 */
export function weeklyLeaderboards<T extends Score & { level: string; gender: Gender | null; athlete_id: string }>(
  blocks: { type: ScoreType; results: T[] }[],
) {
  return (Object.keys(GENDERS) as Gender[])
    .map((gender) => {
      const boards = blocks
        .filter((b) => b.type !== 'none')
        .map((b) => leaderboards(b.type, b.results).find((x) => x.gender === gender)?.rows ?? [])
        .filter((rows) => rows.length > 0)
      const athletes = new Map<string, T>()
      for (const rows of boards) for (const { result } of rows) if (!athletes.has(result.athlete_id)) athletes.set(result.athlete_id, result)
      const placesByBoard = boards.map((rows) => {
        const places = boardPlaces(rows)
        return new Map(rows.map((row, i) => [row.result.athlete_id, places[i]]))
      })
      const scored = [...athletes.values()].map((athlete) => {
        /** null: block not scored by this athlete. */
        const places = placesByBoard.map((byAthlete) => byAthlete.get(athlete.athlete_id) ?? null)
        const done = places.filter((p) => p != null)
        return { athlete, places, done: done.length, average: done.reduce((sum, p) => sum + p, 0) / done.length }
      })
      const compare = (a: (typeof scored)[number], b: (typeof scored)[number]) => a.average - b.average || b.done - a.done
      scored.sort(compare)
      const rows = scored.map((row, i) => {
        let rank = i + 1
        while (rank > 1 && compare(scored[rank - 2], row) === 0) rank--
        return { ...row, rank }
      })
      return { gender, blocks: boards.length, rows }
    })
    .filter((b) => b.rows.length > 0)
}
