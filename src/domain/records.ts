// Personal records: best entries and loads computed from a percentage of the 1RM.
import { compareScores, emptyScore, type Score, type ScoreType } from './scoring'
import { formatDuration, formatNumber, type Measure } from './workout'

export type LoadRecord = { exercise_id: string; rep_max: number; load_kg: number; date: string }
/** Exercise not measured in load (V-up, Plank, Run…): best value in the exercise's unit, higher is better. */
export type MaxRecord = { exercise_id: string; value: number; date: string }
export type BenchmarkRecord = Score & { benchmark_name: string; score_type: ScoreType; date: string }

/** Load for a percentage of the 1RM, rounded to the kilogram. */
export const loadFromPct = (oneRm: number, pct: number) => Math.round((oneRm * pct) / 100)

/** Best load per exercise and rep max: Map<exercise_id, Map<rep_max, record>>. */
export function bestLoads<T extends LoadRecord>(records: T[]): Map<string, Map<number, T>> {
  const out = new Map<string, Map<number, T>>()
  for (const r of records) {
    const byRm = out.get(r.exercise_id) ?? new Map<number, T>()
    const best = byRm.get(r.rep_max)
    if (!best || r.load_kg > best.load_kg || (r.load_kg === best.load_kg && r.date > best.date)) byRm.set(r.rep_max, r)
    out.set(r.exercise_id, byRm)
  }
  return out
}

/** True 1RM only (no estimate from 3RM/5RM). */
export function oneRepMaxes(records: LoadRecord[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const [exercise, byRm] of bestLoads(records)) {
    const one = byRm.get(1)
    if (one) out.set(exercise, one.load_kg)
  }
  return out
}

/** Best value per exercise (ties: most recent). */
export function bestMaxes<T extends MaxRecord>(records: T[]): Map<string, T> {
  const out = new Map<string, T>()
  for (const r of records) {
    const best = out.get(r.exercise_id)
    if (!best || r.value > best.value || (r.value === best.value && r.date > best.date)) out.set(r.exercise_id, r)
  }
  return out
}

/** Field label of a max record, by the exercise's measure (never load: those use a rep max + kg). */
export const MAX_LABELS: Record<Exclude<Measure, 'load'>, string> = {
  reps: 'Max de répétitions',
  time: 'Meilleur temps tenu',
  distance: 'Distance max (m)',
  calories: 'Calories max',
}

/** 25 reps, 1:30, 400 m, 30 cal. */
export function formatMax(measure: Measure, value: number): string {
  if (measure === 'time') return formatDuration(value)
  const unit = { reps: 'reps', distance: 'm', calories: 'cal', load: 'kg' }[measure]
  return `${formatNumber(value)} ${unit}`
}

/** Best score per benchmark name (case-insensitive), ranked like a leaderboard. */
export function bestBenchmarks<T extends BenchmarkRecord>(records: T[]): Map<string, T> {
  const out = new Map<string, T>()
  for (const r of records) {
    const key = r.benchmark_name.trim().toLowerCase()
    const best = out.get(key)
    if (!best || compareScores(r.score_type, { ...emptyScore(), ...r }, { ...emptyScore(), ...best }) < 0) out.set(key, r)
  }
  return out
}

export const BENCHMARKS = ['Fran', 'Grace', 'Isabel', 'Helen', 'Diane', 'Elizabeth', 'Annie', 'Karen', 'Jackie', 'Cindy', 'Murph', 'Chelsea']
