// Score types, formatting and leaderboard ranking. Genders are never mixed; only RX scores are ranked.
import { GENDERS, type Gender } from './profile'
import { formatDuration, type Format, type FormatParams } from './workout'

export type ScoreType = 'time' | 'rounds_reps' | 'load' | 'reps' | 'none'

export const SCORE_TYPES: Record<ScoreType, string> = {
  time: 'Temps',
  rounds_reps: 'Rounds + reps',
  reps: 'Reps',
  load: 'Charge',
  none: 'Aucun',
}

/** The coach's choice for the block, else the format's default. */
export function scoreType(format: Format, params: FormatParams = {}): ScoreType {
  return params.score ?? defaultScoreType(format)
}

/** Scored and counted in the leaderboards: premium blocks never are, other blocks unless the coach said no. */
export function isRanked(format: Format, params: FormatParams = {}): boolean {
  return scoreType(format, params) !== 'none' && !params.min_level && params.ranked !== false
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

/** A result as ranked in a board: its rank among the RX, null when scaled (shown, never ranked). */
export type BoardRow<T> = { result: T; rank: number | null }

/**
 * One leaderboard per gender (men first, skipping empty ones): the RX ranked, then the scaled scores unranked in entry
 * order (done in different conditions, they can't be compared).
 */
export function leaderboards<T extends Score & { rx: boolean; gender: Gender | null; created_at?: string }>(type: ScoreType, list: T[]) {
  return (Object.keys(GENDERS) as Gender[])
    .map((gender) => {
      const rows = boardRows(type, list.filter((r) => (r.gender ?? 'male') === gender))
      return { gender, rows }
    })
    .filter((b) => b.rows.length > 0)
}

/** One board: the RX ranked, then the scaled scores unranked in entry order. */
function boardRows<T extends Score & { rx: boolean; created_at?: string }>(type: ScoreType, list: T[]): BoardRow<T>[] {
  const scaled = list.filter((r) => !r.rx).sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  return [...rankResults(type, list.filter((r) => r.rx)), ...scaled.map((result) => ({ result, rank: null }))]
}

// Team WODs ---------------------------------------------------------------------

export type TeamCategory = Gender | 'mixed'
export const TEAM_CATEGORIES: Record<TeamCategory, string> = { male: 'Hommes', female: 'Femmes', mixed: 'Mixte' }
/** Teammate without an account: a name, and a gender for the team's category. */
export type TeamGuest = { name: string; gender: Gender }

/** All men, all women, else mixed (one woman among men is mixed, like one man among women). */
export function teamCategory(genders: (Gender | null)[]): TeamCategory {
  const all = genders.map((g) => g ?? 'male')
  return all.every((g) => g === 'male') ? 'male' : all.every((g) => g === 'female') ? 'female' : 'mixed'
}

export function parseGuests(json: unknown): TeamGuest[] {
  if (!Array.isArray(json)) return []
  return json.flatMap((g) =>
    g && typeof g.name === 'string' && g.name.trim() ? [{ name: g.name.trim(), gender: g.gender === 'female' ? 'female' : 'male' }] : [],
  )
}

type TeamRow = Score & { id: string; athlete_id: string; team_id: string | null; team_guests: unknown; rx: boolean; gender: Gender | null; created_at?: string }
export type Team<T> = Score & {
  id: string
  members: T[]
  guests: TeamGuest[]
  rx: boolean
  created_at?: string
  category: TeamCategory
  /** Row that carries the team's claps: the smallest result id, the same for every viewer. */
  clapTarget: string
}

/** Results of a team block grouped by team (rows sharing team_id; a row without team is a team of its own). */
export function groupTeams<T extends TeamRow>(list: T[]): Team<T>[] {
  const byTeam = new Map<string, T[]>()
  for (const r of list) {
    const key = r.team_id ?? r.id
    byTeam.set(key, [...(byTeam.get(key) ?? []), r])
  }
  return [...byTeam.entries()].map(([id, members]) => {
    const first = members[0]
    const guests = parseGuests(first.team_guests)
    return {
      id,
      members,
      guests,
      time_s: first.time_s,
      capped: first.capped,
      rounds: first.rounds,
      reps: first.reps,
      load_kg: first.load_kg,
      rx: first.rx,
      created_at: first.created_at,
      category: teamCategory([...members.map((m) => m.gender), ...guests.map((g) => g.gender)]),
      clapTarget: members.map((m) => m.id).sort()[0],
    }
  })
}

/** One board per team category (men, women, mixed, skipping empty ones), ranked like the solo boards. */
export function teamBoards<T extends TeamRow>(type: ScoreType, list: T[]) {
  const teams = groupTeams(list)
  return (Object.keys(TEAM_CATEGORIES) as TeamCategory[])
    .map((category) => ({ category, rows: boardRows(type, teams.filter((t) => t.category === category)) }))
    .filter((b) => b.rows.length > 0)
}

/** Compact block board: the RX top 3 (medals), plus my row (or my team) when further down or scaled. */
export function compactRows<R extends BoardRow<{ athlete_id: string } | { members: { athlete_id: string }[] }>>(
  rows: R[],
  me: string | undefined,
): R[] {
  const mine = (r: R['result']) => ('members' in r ? r.members.some((m) => m.athlete_id === me) : r.athlete_id === me)
  return rows.filter((row, i) => (row.rank !== null && i < 3) || mine(row.result))
}

export type WeeklyPlace = { place: number; missed: boolean; points: number; counted: boolean }

/** Number of blocks that make the weekly total. */
export const WEEKLY_COUNTED = 3
/** Points of a place in a block: 10 for the 1st, 9 for the 2nd... 1 for the 10th, 0 beyond. */
export const weeklyPoints = (place: number) => Math.max(0, 11 - place)
/** Best possible weekly total (crown). */
export const WEEKLY_MAX = WEEKLY_COUNTED * weeklyPoints(1)

/**
 * Weekly leaderboard, one per gender: on each scored block of the week an athlete gets their RX rank in the block's
 * board, worth 10 points for the 1st down to 1 for the 10th, 0 beyond or when not scored or scaled. The total
 * is the sum of the athlete's 3 best blocks, highest wins. A bonus block (challenge of the week) never adds points: it
 * only breaks ties, best place first, athletes who didn't do it last. Blocks without score, or that nobody of this
 * gender scored, don't count.
 */
export function weeklyLeaderboards<T extends Score & { rx: boolean; gender: Gender | null; athlete_id: string }>(
  blocks: { type: ScoreType; results: T[]; bonus?: boolean; label?: string }[],
) {
  return (Object.keys(GENDERS) as Gender[])
    .map((gender) => {
      const scored = blocks
        .filter((b) => b.type !== 'none')
        .map((b) => ({
          bonus: !!b.bonus,
          label: b.label ?? '',
          rows: rankResults(b.type, b.results.filter((r) => r.rx && (r.gender ?? 'male') === gender)),
        }))
        .filter((b) => b.rows.length > 0)
      const athletes = new Map<string, T>()
      for (const { rows } of scored) for (const { result } of rows) if (!athletes.has(result.athlete_id)) athletes.set(result.athlete_id, result)
      const placesByBoard = scored.map(({ rows }) => new Map(rows.map((row) => [row.result.athlete_id, row.rank])))
      const totals = [...athletes.values()].map((athlete) => {
        const places: WeeklyPlace[] = placesByBoard.map((byAthlete) => {
          const place = byAthlete.get(athlete.athlete_id)
          return place == null
            ? { place: byAthlete.size + 1, missed: true, points: 0, counted: false }
            : { place, missed: false, points: weeklyPoints(place), counted: false }
        })
        const regular = places.filter((_, i) => !scored[i].bonus)
        for (const p of [...regular].sort((a, b) => b.points - a.points || a.place - b.place).slice(0, WEEKLY_COUNTED)) p.counted = true
        const tiebreak = Math.min(Infinity, ...places.filter((p, i) => scored[i].bonus && !p.missed).map((p) => p.place))
        return { athlete, places, total: regular.reduce((sum, p) => sum + (p.counted ? p.points : 0), 0), tiebreak }
      })
      totals.sort((a, b) => b.total - a.total || a.tiebreak - b.tiebreak)
      const rows = totals.map((row, i) => {
        let rank = i + 1
        while (rank > 1 && totals[rank - 2].total === row.total && totals[rank - 2].tiebreak === row.tiebreak) rank--
        return { ...row, rank, crown: row.total >= WEEKLY_MAX }
      })
      return { gender, blocks: scored.length, labels: scored.map((b) => b.label), bonus: scored.map((b) => b.bonus), rows }
    })
    .filter((b) => b.rows.length > 0)
}

/** The viewer's own gender board first (women see the women's board first), the others keep their order. */
export function myGenderFirst<B extends { gender: Gender }>(boards: B[], mine: string | null | undefined): B[] {
  return [...boards].sort((a, b) => Number(b.gender === mine) - Number(a.gender === mine))
}
