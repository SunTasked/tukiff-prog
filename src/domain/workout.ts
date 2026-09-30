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
  /** Score type chosen by the coach; absent = the format's default (see scoring.ts). */
  score?: 'time' | 'rounds_reps' | 'load' | 'reps' | 'none'
  /** Minimum access level of the program member (ACCESS_LEVELS); absent = everyone. Checked by RLS. */
  min_level?: number
  /** false = scored, but out of the weekly leaderboard and without a block leaderboard. */
  ranked?: false
}

/**
 * Access level of a program above "Base" (level 0): programs.access_levels[i] is level i + 1. Levels stack.
 * preview: its blocks show greyed and locked to the lower levels; off, they are hidden.
 */
export type AccessLevel = { name: string; preview: boolean }
export const BASE_LEVEL = 'Base'

export const levelName = (levels: AccessLevel[] | undefined, level: number) =>
  level === 0 ? BASE_LEVEL : levels?.[level - 1]?.name || `Niveau ${level}`

export const isPremium = (b: Pick<BlockDraft, 'params'>) => (b.params.min_level ?? 0) > 0

/** Settings that are not the format's own: kept when the format changes, ignored by score invalidation. */
export const blockSettings = ({ min_level, ranked }: FormatParams): FormatParams => ({
  ...(min_level ? { min_level } : {}),
  ...(ranked === false ? { ranked } : {}),
})

export type LevelOverride = {
  reps?: string
  load_kg?: number
  load_kg_f?: number
  pct_1rm?: number
  distance_m?: number
  calories?: number
  duration_s?: number
  exercise_id?: string
  note?: string
}

export type ItemDraft = {
  exercise_id: string | null
  label: string
  reps: string
  /** Absolute load; for everyone, or men when load_kg_f is set. */
  load_kg: number | null
  /** Women's absolute load; null = same as load_kg. */
  load_kg_f: number | null
  pct_1rm: number | null
  distance_m: number | null
  calories: number | null
  duration_s: number | null
  notes: string
  levels: Partial<Record<AltLevel, LevelOverride>>
  /** Index of the sub-block (BlockDraft.groups) the item belongs to; null = directly in the block. */
  group: number | null
}

/**
 * Sub-block: movements repeated together ("DB DT"), with what changes each round underneath.
 * start/step: rounds of the sub-block in the n-th round of the block = start + (n - 1) × step (default 1 and 0: once).
 */
export type GroupDraft = { title: string; note: string; start?: number; step?: number }

export type BlockDraft = {
  id: string
  kind: BlockKind
  title: string
  format: Format
  params: FormatParams
  notes: string
  items: ItemDraft[]
  groups: GroupDraft[]
}

/** date / program_id: null = library template; set = scheduled workout (only used when creating). */
export type WorkoutDraft = {
  id?: string
  title: string
  notes: string
  date?: string | null
  /** Number of days the workout lasts from its date (1 = a normal workout). */
  days?: number
  program_id?: string | null
  /** Library templates only. */
  section_id?: string | null
  blocks: BlockDraft[]
  /** The program's access levels (scheduled workouts). */
  access_levels?: AccessLevel[]
  /** Blocks above my access level (title only), shown closed; before = index in blocks it precedes. */
  locked?: LockedBlock[]
}

export type LockedBlock = { id: string; kind: BlockKind; title: string; before: number }

/**
 * A workout as an athlete of the given level would see it (a coach's preview; the server applies the same rule):
 * blocks above that level become locked if their level allows previews, else they disappear.
 */
export function viewAs(w: WorkoutDraft, level: number): WorkoutDraft {
  const blocks: BlockDraft[] = []
  const locked: LockedBlock[] = []
  for (const b of w.blocks) {
    const min = b.params.min_level ?? 0
    if (min <= level) blocks.push(b)
    else if (w.access_levels?.[min - 1]?.preview ?? true)
      locked.push({ id: b.id, kind: b.kind, title: b.title, before: blocks.length })
  }
  return { ...w, blocks, locked: [...(w.locked ?? []), ...locked] }
}

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


export function emptyItem(exercise_id: string | null = null, label = ''): ItemDraft {
  return {
    exercise_id,
    label,
    reps: '',
    load_kg: null,
    load_kg_f: null,
    pct_1rm: null,
    distance_m: null,
    calories: null,
    duration_s: null,
    notes: '',
    levels: {},
    group: null,
  }
}

/** The kind is only a label: every new block starts free ("Libre"), the coach picks its format. */
export function newBlock(kind: BlockKind, id: string): BlockDraft {
  return { id, kind, title: '', format: 'none', params: {}, notes: '', items: [], groups: [] }
}

/** Kind suggested for the n-th block (0-based) of a typical CrossFit class. */
export function suggestedKind(index: number): BlockKind {
  return (['warmup', 'strength', 'metcon'] as const)[index] ?? 'accessory'
}

// Durations ---------------------------------------------------------------------

/** 720 -> "12:00", 90 -> "1:30", 452.4 -> "7:32,4" (tenth shown only when there is one). */
export function formatDuration(seconds: number): string {
  const tenths = Math.round(seconds * 10)
  const m = Math.floor(tenths / 600)
  const s = Math.floor((tenths % 600) / 10)
  const t = tenths % 10
  return `${m}:${String(s).padStart(2, '0')}${t ? `,${t}` : ''}`
}

/**
 * Minutes and seconds typed separately ("7", "32,4") -> 452.4 seconds.
 * Both empty -> null; anything unreadable (letters, seconds >= 60, two decimals) -> undefined.
 */
export function parseDuration(minutes: string, seconds: string): number | null | undefined {
  const min = minutes.trim()
  const sec = seconds.trim()
  if (!min && !sec) return null
  if (min && !/^\d{1,3}$/.test(min)) return undefined
  const match = sec ? /^(\d{1,2})(?:[.,](\d)?)?$/.exec(sec) : ['', '0']
  if (!match || Number(match[1]) >= 60) return undefined
  return Math.round((Number(min || 0) * 60 + Number(match[1]) + Number(match[2] ?? 0) / 10) * 10) / 10
}

/** 452.4 -> ["7", "32,4"], 65 -> ["1", "05"]: the two fields of a duration input. */
export function durationParts(seconds: number): [string, string] {
  const [m, rest] = formatDuration(seconds).split(':')
  return [m, rest]
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
  // Distance, calories and duration are one quantity: overriding one replaces the RX's (20 cal -> 500 m).
  const quantity = o.distance_m !== undefined || o.calories !== undefined || o.duration_s !== undefined
  const q = (v: number | undefined, rx: number | null) => (quantity ? (v ?? null) : rx)
  return {
    ...item,
    exercise_id: o.exercise_id ?? item.exercise_id,
    reps: o.reps ?? item.reps,
    load_kg: o.load_kg ?? item.load_kg,
    // A level load given without a women's load applies to everyone.
    load_kg_f: o.load_kg_f ?? (o.load_kg !== undefined ? null : item.load_kg_f),
    pct_1rm: o.pct_1rm ?? item.pct_1rm,
    distance_m: q(o.distance_m, item.distance_m),
    calories: q(o.calories, item.calories),
    duration_s: q(o.duration_s, item.duration_s),
    notes: o.note ?? item.notes,
  }
}

/** "43" or, with a different women's load, "43/29". */
export const formatLoad = (kg: number, kgF: number | null) =>
  kgF != null && kgF !== kg ? `${formatNumber(kg)}/${formatNumber(kgF)}` : formatNumber(kg)

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
  if (item.load_kg != null) loads.push(`${formatLoad(item.load_kg, item.load_kg_f)} kg`)
  if (item.pct_1rm != null) loads.push(`${formatNumber(item.pct_1rm)} %`)
  return loads.length ? `${parts.join(' ')} @ ${loads.join(' / ')}` : parts.join(' ')
}

export const hasOverride = (o: LevelOverride | undefined) => !!o && Object.values(o).some((v) => v !== undefined)

export function validateWorkout(w: WorkoutDraft): string | null {
  if (!w.title.trim()) return 'Donne un titre à la séance.'
  for (const [i, b] of w.blocks.entries()) {
    if (b.items.some((it) => !it.exercise_id && !it.label.trim())) return `Bloc ${i + 1} : un mouvement n’a pas d’exercice.`
  }
  return null
}

/** What a score depends on: kind, title and notes excluded (fixing a typo keeps the scores). */
const scoringSignature = (b: BlockDraft) => {
  const { min_level: _level, ranked: _ranked, ...params } = b.params
  return JSON.stringify([b.format, params, b.items])
}

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

/** Levels offered for a block: RX plus the levels the coach defined in its items, in LEVELS order. */
export function blockLevels(block: BlockDraft): Level[] {
  return (Object.keys(LEVELS) as Level[]).filter(
    (l) => l === 'rx' || block.items.some((i) => hasOverride(i.levels[l as AltLevel])),
  )
}

// Faster entry ------------------------------------------------------------------

/** Items of the workout, those of the given block first, most recent first. */
function itemsNearest(w: WorkoutDraft, blockIndex: number): ItemDraft[] {
  const current = w.blocks[blockIndex]?.items ?? []
  const others = w.blocks.filter((_, i) => i !== blockIndex).flatMap((b) => b.items)
  return [...current].reverse().concat([...others].reverse())
}

/** Exercises already in the workout (likely reused), nearest first. */
export function usedExercises(w: WorkoutDraft, blockIndex: number): string[] {
  const ids = itemsNearest(w, blockIndex).flatMap((i) => (i.exercise_id ? [i.exercise_id] : []))
  return [...new Set(ids)]
}

/** New item for an exercise, with the loads (and level loads) of its nearest use in the workout: only the reps change. */
export function prefilledItem(w: WorkoutDraft, blockIndex: number, exerciseId: string): ItemDraft {
  const prev = itemsNearest(w, blockIndex).find((i) => i.exercise_id === exerciseId)
  if (!prev) return emptyItem(exerciseId)
  const levels: ItemDraft['levels'] = {}
  for (const l of ALT_LEVELS) {
    const o = prev.levels[l]
    if (!o) continue
    const { exercise_id, load_kg, load_kg_f, pct_1rm } = o
    const kept = Object.fromEntries(
      Object.entries({ exercise_id, load_kg, load_kg_f, pct_1rm }).filter(([, v]) => v !== undefined),
    ) as LevelOverride
    if (hasOverride(kept)) levels[l] = kept
  }
  return { ...emptyItem(exerciseId), load_kg: prev.load_kg, load_kg_f: prev.load_kg_f, pct_1rm: prev.pct_1rm, levels }
}

// Sub-blocks --------------------------------------------------------------------

export type ItemRun = { group: number | null; items: { item: ItemDraft; index: number }[] }

/** Consecutive items of the same sub-block, in order; sub-blocks without items come last, empty. */
export function itemRuns(block: BlockDraft): ItemRun[] {
  const runs: ItemRun[] = []
  block.items.forEach((item, index) => {
    const last = runs.at(-1)
    if (last && last.group === item.group) last.items.push({ item, index })
    else runs.push({ group: item.group, items: [{ item, index }] })
  })
  for (const [g] of block.groups.entries()) if (!runs.some((r) => r.group === g)) runs.push({ group: g, items: [] })
  return runs
}

/** Adds an item at the end of the block, or at the end of a sub-block (its items stay together). */
export function addItem(block: BlockDraft, item: ItemDraft, group: number | null = null): ItemDraft[] {
  const it = { ...item, group }
  if (group === null) return [...block.items, it]
  const last = block.items.findLastIndex((i) => i.group === group)
  return block.items.toSpliced(last === -1 ? block.items.length : last + 1, 0, it)
}

/** Removes a sub-block; its items stay in the block. */
export function removeGroup(block: BlockDraft, group: number): Pick<BlockDraft, 'items' | 'groups'> {
  const shift = (g: number | null) => (g === null || g < group ? g : g === group ? null : g - 1)
  return { groups: block.groups.filter((_, i) => i !== group), items: block.items.map((i) => ({ ...i, group: shift(i.group) })) }
}
