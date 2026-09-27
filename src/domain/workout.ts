// Workout model shared by the editor and the read-only view. Pure functions only.

export const BLOCK_KINDS = {
  warmup: 'Échauffement',
  strength: 'Force',
  skill: 'Skill',
  metcon: 'Metcon',
  accessory: 'Accessoires',
  cooldown: 'Retour au calme',
} as const
export type BlockKind = keyof typeof BLOCK_KINDS

export const FORMATS = {
  for_time: 'For Time',
  amrap: 'AMRAP',
  emom: 'EMOM',
  tabata: 'Tabata',
  sets_reps: 'Séries × reps',
  none: 'Libre',
} as const
export type Format = keyof typeof FORMATS

export const MEASURES = {
  reps: 'Répétitions',
  load: 'Charge',
  distance: 'Distance',
  time: 'Temps',
  calories: 'Calories',
} as const
export type Measure = keyof typeof MEASURES

export const LEVELS = { elite: 'Elite', rx: 'RX', scaled: 'Scaled', foundation: 'Foundation' } as const
export type Level = keyof typeof LEVELS
export type AltLevel = Exclude<Level, 'rx'>
export const ALT_LEVELS: AltLevel[] = ['elite', 'scaled', 'foundation']

export type FormatParams = {
  time_cap_s?: number // for_time
  duration_s?: number // amrap
  interval_s?: number // emom
  rounds?: number // emom, tabata, for_time (rounds for time)
  work_s?: number // tabata
  rest_s?: number // tabata
  sets?: number // sets_reps
}

export type LevelOverride = { reps?: string; load_kg?: number; exercise_id?: string; note?: string }

export type ItemDraft = {
  exercise_id: string | null
  label: string
  reps: string
  load_kg: number | null
  pct_1rm: number | null
  distance_m: number | null
  calories: number | null
  duration_s: number | null
  notes: string
  levels: Partial<Record<AltLevel, LevelOverride>>
}

export type BlockDraft = {
  id: string
  kind: BlockKind
  title: string
  format: Format
  params: FormatParams
  notes: string
  items: ItemDraft[]
}

/** date: null = library template; set = scheduled copy (only used when creating). */
export type WorkoutDraft = { id?: string; title: string; notes: string; date?: string | null; blocks: BlockDraft[] }

export function defaultParams(format: Format): FormatParams {
  switch (format) {
    case 'for_time':
      return { time_cap_s: 12 * 60 }
    case 'amrap':
      return { duration_s: 12 * 60 }
    case 'emom':
      return { interval_s: 60, rounds: 10 }
    case 'tabata':
      return { rounds: 8, work_s: 20, rest_s: 10 }
    case 'sets_reps':
      return { sets: 5 }
    case 'none':
      return {}
  }
}

/** Default format when picking a block kind. */
export const DEFAULT_FORMAT: Record<BlockKind, Format> = {
  warmup: 'none',
  strength: 'sets_reps',
  skill: 'none',
  metcon: 'for_time',
  accessory: 'sets_reps',
  cooldown: 'none',
}

export function emptyItem(exercise_id: string | null = null, label = ''): ItemDraft {
  return {
    exercise_id,
    label,
    reps: '',
    load_kg: null,
    pct_1rm: null,
    distance_m: null,
    calories: null,
    duration_s: null,
    notes: '',
    levels: {},
  }
}

export function newBlock(kind: BlockKind, id: string): BlockDraft {
  const format = DEFAULT_FORMAT[kind]
  return { id, kind, title: '', format, params: defaultParams(format), notes: '', items: [] }
}

/** Kind suggested for the n-th block (0-based) of a typical CrossFit class. */
export function suggestedKind(index: number): BlockKind {
  return (['warmup', 'strength', 'metcon'] as const)[index] ?? 'accessory'
}

// Durations ---------------------------------------------------------------------

/**
 * "12" -> 720 (minutes), "1:30" -> 90, "0:45" -> 45. Returns null if invalid.
 * "," and "." are accepted as separators (iOS numeric pads have no ":").
 */
export function parseDuration(input: string): number | null {
  const s = input.trim()
  if (!s) return null
  const m = s.match(/^(\d+)(?:[:.,]([0-5]\d))?$/)
  if (!m) return null
  return m[2] === undefined ? Number(m[1]) * 60 : Number(m[1]) * 60 + Number(m[2])
}

/** 720 -> "12:00", 90 -> "1:30". */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Compact label: 720 -> "12'", 90 -> "1'30", 20 -> "20\"". */
export function shortDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}"`
  return s === 0 ? `${m}'` : `${m}'${String(s).padStart(2, '0')}`
}

/** Parses "42,5" or "42.5"; empty -> null. */
export function parseNumber(input: string): number | null {
  const s = input.trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export const formatNumber = (n: number) => String(n).replace('.', ',')

// Summaries ---------------------------------------------------------------------

export function formatSummary(format: Format, p: FormatParams): string {
  switch (format) {
    case 'for_time': {
      const rounds = p.rounds && p.rounds > 1 ? `${p.rounds} rounds ` : ''
      return `${rounds}For Time${p.time_cap_s ? ` · cap ${shortDuration(p.time_cap_s)}` : ''}`
    }
    case 'amrap':
      return `AMRAP${p.duration_s ? ` ${shortDuration(p.duration_s)}` : ''}`
    case 'emom': {
      const interval = p.interval_s ?? 60
      const total = p.rounds ? ` ${shortDuration(interval * p.rounds)}` : ''
      return interval === 60 ? `EMOM${total}` : `E${shortDuration(interval)}MOM${total}`
    }
    case 'tabata':
      return `Tabata ${p.rounds ?? 8} × ${p.work_s ?? 20}"/${p.rest_s ?? 10}"`
    case 'sets_reps':
      return p.sets ? `${p.sets} séries` : 'Séries'
    case 'none':
      return ''
  }
}

/** Prescription of an item for a level: the RX base with the level's overrides applied. */
export function resolveItem(item: ItemDraft, level: Level): ItemDraft {
  if (level === 'rx') return item
  const o = item.levels[level]
  if (!o) return item
  return {
    ...item,
    exercise_id: o.exercise_id ?? item.exercise_id,
    reps: o.reps ?? item.reps,
    load_kg: o.load_kg ?? item.load_kg,
    notes: o.note ?? item.notes,
  }
}

/** One-line text: "21-15-9 Thruster @ 43 kg". */
export function itemSummary(item: ItemDraft, exerciseName: (id: string) => string | undefined): string {
  const name = (item.exercise_id && exerciseName(item.exercise_id)) || item.label || '?'
  const parts: string[] = []
  if (item.reps) parts.push(item.reps)
  if (item.distance_m != null) parts.push(`${formatNumber(item.distance_m)} m`)
  if (item.calories != null) parts.push(`${formatNumber(item.calories)} cal`)
  if (item.duration_s != null) parts.push(shortDuration(item.duration_s))
  parts.push(name)
  const loads: string[] = []
  if (item.load_kg != null) loads.push(`${formatNumber(item.load_kg)} kg`)
  if (item.pct_1rm != null) loads.push(`${formatNumber(item.pct_1rm)} %`)
  return loads.length ? `${parts.join(' ')} @ ${loads.join(' / ')}` : parts.join(' ')
}

export const hasOverride = (o: LevelOverride | undefined) =>
  !!o && (o.reps !== undefined || o.load_kg !== undefined || o.exercise_id !== undefined || o.note !== undefined)

export function validateWorkout(w: WorkoutDraft): string | null {
  if (!w.title.trim()) return 'Donne un titre à la séance.'
  for (const [i, b] of w.blocks.entries()) {
    if (b.items.some((it) => !it.exercise_id && !it.label.trim())) return `Bloc ${i + 1} : un mouvement n’a pas d’exercice.`
  }
  return null
}

/** What a score depends on: title and notes excluded (fixing a typo keeps the scores). */
const scoringSignature = (b: BlockDraft) => JSON.stringify([b.kind, b.format, b.params, b.items])

/** Blocks of the original workout whose scores become invalid: scoring content changed, or removed. */
export function invalidatedBlocks(original: WorkoutDraft, draft: WorkoutDraft): { changed: string[]; removed: string[] } {
  const current = new Map(draft.blocks.map((b) => [b.id, b]))
  const changed: string[] = []
  const removed: string[] = []
  for (const b of original.blocks) {
    const now = current.get(b.id)
    if (!now) removed.push(b.id)
    else if (scoringSignature(now) !== scoringSignature(b)) changed.push(b.id)
  }
  return { changed, removed }
}
