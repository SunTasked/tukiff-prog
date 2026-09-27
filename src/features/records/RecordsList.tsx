import { useState } from 'react'
import { Card } from '../../components/ui'
import { formatDay } from '../../domain/dates'
import { bestBenchmarks, bestLoads, type BenchmarkRecord, type LoadRecord } from '../../domain/records'
import { emptyScore, formatScore, type ScoreType } from '../../domain/scoring'
import { formatNumber } from '../../domain/workout'
import { supabase, type PersonalRecord } from '../../lib/supabase'

/** Best loads per exercise and best benchmark scores, with history on tap. */
export function RecordsList({
  records,
  nameOf,
  editable,
  onChange,
}: {
  records: PersonalRecord[]
  nameOf: (id: string) => string | undefined
  editable: boolean
  onChange?: () => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const loads = records.filter((r): r is PersonalRecord & LoadRecord => r.exercise_id !== null)
  const benches = records.filter((r) => r.benchmark_name !== null) as (PersonalRecord & BenchmarkRecord)[]
  const bestByExercise = [...bestLoads(loads)].sort(([a], [b]) => (nameOf(a) ?? '').localeCompare(nameOf(b) ?? ''))
  const bestBench = [...bestBenchmarks(benches).values()].sort((a, b) => a.benchmark_name.localeCompare(b.benchmark_name))
  const score = (r: PersonalRecord) => formatScore(r.score_type as ScoreType, { ...emptyScore(), ...r })

  async function remove(id: string) {
    if (!confirm('Supprimer cette entrée ?')) return
    await supabase.from('personal_records').delete().eq('id', id)
    onChange?.()
  }

  const history = (list: PersonalRecord[], label: (r: PersonalRecord) => string) => (
    <ul className="mt-2 flex flex-col gap-1 text-sm">
      {list.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-950 px-2 py-1.5">
          <span className="text-zinc-400 capitalize">{formatDay(r.date)}</span>
          <span className="min-w-0 flex-1 truncate text-right">
            {label(r)}
            {r.notes && <span className="text-zinc-500"> · {r.notes}</span>}
          </span>
          {editable && (
            <button className="text-red-400" aria-label="Supprimer" onClick={() => remove(r.id)}>
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  )

  if (!records.length) return <p className="text-sm text-zinc-500">Aucun record pour l’instant.</p>

  return (
    <div className="flex flex-col gap-4">
      {bestByExercise.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">Charges</h2>
          <ul className="divide-y divide-zinc-800">
            {bestByExercise.map(([exerciseId, byRm]) => (
              <li key={exerciseId} className="py-2">
                <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen(open === exerciseId ? null : exerciseId)}>
                  <span className="truncate">{nameOf(exerciseId) ?? '?'}</span>
                  <span className="flex shrink-0 gap-2 text-sm">
                    {[...byRm.entries()]
                      .sort(([a], [b]) => a - b)
                      .map(([rm, r]) => (
                        <span key={rm}>
                          <span className="text-zinc-500">{rm}RM</span> <b>{formatNumber(r.load_kg)}</b>
                        </span>
                      ))}
                  </span>
                </button>
                {open === exerciseId &&
                  history(
                    loads.filter((r) => r.exercise_id === exerciseId),
                    (r) => `${r.rep_max}RM · ${formatNumber(r.load_kg!)} kg`,
                  )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {bestBench.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">Benchmarks</h2>
          <ul className="divide-y divide-zinc-800">
            {bestBench.map((best) => {
              const key = best.benchmark_name.trim().toLowerCase()
              return (
                <li key={key} className="py-2">
                  <button className="flex w-full justify-between gap-2 text-left" onClick={() => setOpen(open === key ? null : key)}>
                    <span className="truncate">{best.benchmark_name}</span>
                    <b className="shrink-0 text-sm">{score(best)}</b>
                  </button>
                  {open === key &&
                    history(
                      benches.filter((r) => r.benchmark_name.trim().toLowerCase() === key),
                      score,
                    )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
