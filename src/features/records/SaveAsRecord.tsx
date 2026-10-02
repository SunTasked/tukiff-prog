import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { formatScore, scoreType } from '../../domain/scoring'
import type { WorkoutDraft } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
import { loadWorkout } from '../workouts/api'
import type { ResultRow } from '../results/useWorkoutResults'
import { scoredBlocks } from './RecordForms'

type BlockLink = { scheduled: string; template: string }

/**
 * Session copied from a library benchmark: once I scored every scored block of the benchmark (RX, solo, not capped),
 * my scores can be saved as a benchmark record in one tap (one entry, dated on the session).
 */
export function SaveAsRecord({ workout, results, me }: { workout: WorkoutDraft; results: ResultRow[]; me: string }) {
  const [links, setLinks] = useState<BlockLink[]>([])
  const [benchmark, setBenchmark] = useState<WorkoutDraft | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    ;(async () => {
      const { data } = await supabase
        .from('workout_blocks')
        .select('id, source_block_id')
        .eq('workout_id', workout.id!)
        .not('source_block_id', 'is', null)
      const found = (data ?? []).map((b) => ({ scheduled: b.id, template: b.source_block_id! }))
      if (!found.length) return
      const { data: src } = await supabase.from('workout_blocks').select('workout_id').eq('id', found[0].template).maybeSingle()
      const template = src && (await loadWorkout(src.workout_id))
      if (!live || !template || template.date) return
      const ids = template.blocks.map((b) => b.id)
      const { data: mine } = await supabase
        .from('personal_records')
        .select('id')
        .eq('athlete_id', me)
        .eq('date', workout.date!)
        .in('block_id', ids)
        .limit(1)
      if (!live) return
      setLinks(found)
      setBenchmark(template)
      setSaved(!!mine?.length)
    })()
    return () => {
      live = false
    }
  }, [workout.id, workout.date, me])

  if (!benchmark) return null
  const blocks = scoredBlocks(benchmark.title, benchmark.blocks)
  // My score on the scheduled copy of each scored benchmark block, with the same score type.
  const scores = blocks.map((b) => {
    const copy = workout.blocks.find((x) => links.some((l) => l.scheduled === x.id && l.template === b.block.id))
    const r = copy && results.find((x) => x.block_id === copy.id && x.athlete_id === me)
    const usable = copy && r && r.rx && !r.capped && !r.team_id && scoreType(copy.format, copy.params) === b.type
    return usable ? r : null
  })
  const to = `/library/workouts/${benchmark.id}`
  if (saved)
    return (
      <Link to={to} className="mt-4 block rounded-xl bg-zinc-800 px-3 py-2 text-center text-sm text-zinc-300">
        ✓ Record enregistré · {benchmark.title} ›
      </Link>
    )
  if (!blocks.length || scores.some((s) => !s)) return null

  async function save() {
    setBusy(true)
    const entry_id = crypto.randomUUID()
    const rows = blocks.map((b, i) => ({
      entry_id,
      workout_id: benchmark!.id!,
      block_id: b.block.id,
      benchmark_name: b.name,
      score_type: b.type,
      time_s: b.type === 'time' ? scores[i]!.time_s : null,
      rounds: b.type === 'rounds_reps' ? scores[i]!.rounds : null,
      reps: b.type === 'rounds_reps' || b.type === 'reps' ? scores[i]!.reps : null,
      load_kg: b.type === 'load' ? scores[i]!.load_kg : null,
      date: workout.date!,
    }))
    const { error } = await supabase.from('personal_records').insert(rows)
    setBusy(false)
    if (error) return setError(error.message)
    setSaved(true)
  }

  return (
    <div className="mt-4">
      <button className="w-full rounded-xl border border-lime-400 py-2 text-sm font-semibold text-lime-400" disabled={busy} onClick={save}>
        Enregistrer comme record · {benchmark.title}
        <span className="block text-xs font-normal text-zinc-400">{blocks.map((b, i) => formatScore(b.type, scores[i]!)).join(' · ')}</span>
      </button>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  )
}
