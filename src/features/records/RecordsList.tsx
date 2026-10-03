import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Card } from '../../components/ui'
import {
  bestBenchmarks,
  bestLoads,
  bestMaxes,
  formatMax,
  type BenchmarkRecord,
  type LoadRecord,
  type MaxRecord,
} from '../../domain/records'
import { emptyScore, formatScore, type ScoreType } from '../../domain/scoring'
import { formatNumber, type Measure } from '../../domain/workout'
import type { PersonalRecord } from '../../lib/supabase'
import { useBenchmarkMovements } from './useRecords'

/**
 * Best loads, gymnastics maxes and benchmark scores, read-only. `linked`: each row opens its benchmark page,
 * where records are entered and their history kept. Movements: the movement benchmarks only (variants count via the hierarchy).
 */
export function RecordsList({
  records,
  loads,
  nameOf,
  measureOf,
  linked,
}: {
  records: PersonalRecord[]
  /** Loads with those inherited from variants (useRecords). */
  loads: (LoadRecord & { via?: string })[]
  nameOf: (id: string) => string | undefined
  measureOf: (id: string) => Measure | undefined
  linked: boolean
}) {
  const maxes = records.filter((r): r is PersonalRecord & MaxRecord => r.exercise_id !== null && r.value !== null)
  const benches = records.filter((r) => r.benchmark_name !== null) as (PersonalRecord & BenchmarkRecord)[]
  const movements = useBenchmarkMovements()
  const byName = (a: string, b: string) => (nameOf(a) ?? '').localeCompare(nameOf(b) ?? '')
  const bestByExercise = [...bestLoads(loads)].filter(([id]) => movements.has(id)).sort(([a], [b]) => byName(a, b))
  const bestMax = [...bestMaxes(maxes).values()]
    .filter((r) => movements.has(r.exercise_id))
    .sort((a, b) => byName(a.exercise_id, b.exercise_id))
  const bestBench = [...bestBenchmarks(benches).values()].sort((a, b) => a.benchmark_name.localeCompare(b.benchmark_name))

  const row = (key: string, to: string | null, name: ReactNode, value: ReactNode) => {
    const content = (
      <>
        <span className="truncate">{name}</span>
        <span className="flex shrink-0 items-center gap-2 text-sm">
          {value}
          {linked && to && <span className="text-zinc-500">›</span>}
        </span>
      </>
    )
    return (
      <li key={key}>
        {linked && to ? (
          <Link to={to} className="flex items-center justify-between gap-2 py-2">
            {content}
          </Link>
        ) : (
          <div className="flex items-center justify-between gap-2 py-2">{content}</div>
        )}
      </li>
    )
  }
  const card = (title: string, rows: ReactNode[]) =>
    rows.length > 0 && (
      <Card>
        <h2 className="mb-1 font-semibold">{title}</h2>
        <ul className="divide-y divide-zinc-800">{rows}</ul>
      </Card>
    )

  if (!records.length) return <p className="text-sm text-zinc-500">Aucun record pour l’instant.</p>

  return (
    <div className="flex flex-col gap-4">
      {card(
        'Charges',
        bestByExercise.map(([id, byRm]) =>
          row(
            id,
            `/library/movements/${id}`,
            <ViaName name={nameOf(id) ?? '?'} via={[...byRm.values()].map((r) => r.via && nameOf(r.via))} />,
            [...byRm.entries()]
              .sort(([a], [b]) => a - b)
              .map(([rm, r]) => (
                <span key={rm}>
                  <span className="text-zinc-500">{rm}RM</span> <b>{formatNumber(r.load_kg)}</b>
                </span>
              )),
          ),
        ),
      )}
      {card(
        'Max',
        bestMax.map((r) =>
          row(
            r.exercise_id,
            `/library/movements/${r.exercise_id}`,
            nameOf(r.exercise_id) ?? '?',
            <b>{formatMax(measureOf(r.exercise_id) ?? 'reps', r.value)}</b>,
          ),
        ),
      )}
      {card(
        'Benchmarks',
        bestBench.map((r) =>
          row(
            r.block_id ?? r.benchmark_name,
            r.workout_id ? `/library/workouts/${r.workout_id}` : null,
            r.benchmark_name,
            <b>{formatScore(r.score_type as ScoreType, { ...emptyScore(), ...r })}</b>,
          ),
        ),
      )}
    </div>
  )
}

/** Lift name, with the variants its bests come from (a Power Snatch counts as a Snatch). */
export function ViaName({ name, via }: { name: string; via: (string | undefined)[] }) {
  const from = [...new Set(via.filter(Boolean))]
  return (
    <>
      {name}
      {from.length > 0 && <span className="block truncate text-xs text-zinc-500">via {from.join(', ')}</span>}
    </>
  )
}
