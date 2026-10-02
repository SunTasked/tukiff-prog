// Personal records: best entries and loads computed from a percentage of the 1RM.
import { compareScores, emptyScore, type Score, type ScoreType } from './scoring'
import { formatDuration, formatNumber, type Measure } from './workout'

export type LoadRecord = { exercise_id: string; rep_max: number; load_kg: number; date: string }
/** Gymnastics exercise (V-up, Pull-up, Plank…): best value in the exercise's unit, higher is better. */
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

/** Records exist for weightlifting (load: rep max + kg) and gymnastics (reps, hold time); not for cardio. */
export const RECORD_MEASURES: readonly Measure[] = ['load', 'reps', 'time']

/** Field label of a max record (gymnastics). */
export const MAX_LABELS = { reps: 'Max de répétitions', time: 'Meilleur temps tenu' } as const

/** 25 reps, 1:30. */
export const formatMax = (measure: Measure, value: number) =>
  measure === 'time' ? formatDuration(value) : `${formatNumber(value)} reps`

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
