import { useEffect, useState, type ReactNode } from 'react'
import { Button, Card, Chips } from '../../components/ui'
import { formatDay } from '../../domain/dates'
import {
  bestBenchmarks,
  bestLoads,
  bestMaxes,
  formatMax,
  withInherited,
  recordEntries,
  RECORD_MEASURES,
  type BenchmarkRecord,
  type MaxRecord,
} from '../../domain/records'
import { GENDERS, type Gender } from '../../domain/profile'
import { compareScores, emptyScore, formatScore, rankResults, type ScoreType } from '../../domain/scoring'
import { formatNumber, type BlockDraft, type Measure } from '../../domain/workout'
import { supabase, type PersonalRecord } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { AthleteName } from '../results/AthleteName'
import { GenderTabs } from '../results/GenderTabs'
import { BenchmarkRecordSheet, ExerciseRecordSheet, scoredBlocks } from './RecordForms'
import { useExercises } from '../exercises/useExercises'
import { useLiftParents, useRecords } from './useRecords'

const score = (r: PersonalRecord) => formatScore(r.score_type as ScoreType, { ...emptyScore(), ...r })

/** My records on a library page: best, entry button, history with deletion (typos). */
function RecordsCard({
  best,
  entries,
  label,
  onAdd,
  onChange,
}: {
  best: ReactNode
  entries: PersonalRecord[][]
  /** One line per score (several for a benchmark with several scored blocks). */
  label: (entry: PersonalRecord[]) => string[]
  onAdd: () => void
  onChange: () => void
}) {
  async function remove(entry: PersonalRecord[]) {
    if (!confirm('Supprimer cette entrée ?')) return
    await supabase.from('personal_records').delete().eq('entry_id', entry[0].entry_id)
    onChange()
  }
  return (
    <Card className="mt-6">
      <h2 className="mb-2 font-semibold">Mes records</h2>
      {entries.length > 0 ? best : <p className="text-sm text-zinc-500">Aucun record pour l’instant.</p>}
      {entries.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {entries.map((e) => (
            <li key={e[0].entry_id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-950 px-2 py-1.5">
              <span className="text-zinc-400 capitalize">{formatDay(e[0].date)}</span>
              <span className="min-w-0 flex-1 text-right break-words">
                {label(e).map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
                {e[0].notes && <span className="block text-zinc-500">{e[0].notes}</span>}
              </span>
              <button className="text-red-400" aria-label="Supprimer" onClick={() => remove(e)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button className="mt-3 w-full" onClick={onAdd}>
        Saisir mon record
      </Button>
    </Card>
  )
}

export function ExerciseRecords({
  exercise,
  adding = false,
  board = false,
}: {
  exercise: { id: string; name: string; measure: string }
  adding?: boolean
  /** Box leaderboard: only on the movement benchmarks (category "Mouvements"). */
  board?: boolean
}) {
  const { session } = useAuth()
  const { records, loads: allLoads, reload } = useRecords(session?.user.id)
  const { nameOf } = useExercises()
  const [open, setOpen] = useState(adding)
  const [version, setVersion] = useState(0)
  const measure = exercise.measure as Measure
  if (!RECORD_MEASURES.includes(measure)) return null

  const mine = records.filter((r) => r.exercise_id === exercise.id)
  const load = measure === 'load'
  const maxes = mine.filter((r): r is PersonalRecord & MaxRecord => r.value !== null)
  // Best per RM, counting my lifts on its variants (via).
  const byRm = bestLoads(allLoads.filter((r) => r.exercise_id === exercise.id)).get(exercise.id)
  const bestMax = bestMaxes(maxes).get(exercise.id)
  const best = load ? (
    <div className="flex flex-wrap gap-3">
      {[...(byRm ?? new Map()).entries()]
        .sort(([a], [b]) => a - b)
        .map(([rm, r]) => (
          <span key={rm}>
            <span className="text-zinc-500">{rm}RM</span> <b>{formatNumber(r.load_kg)} kg</b>
            {r.via && nameOf(r.via) && <span className="text-xs text-zinc-500"> via {nameOf(r.via)}</span>}
          </span>
        ))}
    </div>
  ) : (
    bestMax && <b>{formatMax(measure, bestMax.value)}</b>
  )

  return (
    <>
      <RecordsCard
        best={best}
        entries={recordEntries(mine)}
        label={([r]) => [r.load_kg !== null ? `${r.rep_max}RM · ${formatNumber(r.load_kg)} kg` : formatMax(measure, r.value!)]}
        onAdd={() => setOpen(true)}
        onChange={() => {
          reload()
          setVersion((v) => v + 1)
        }}
      />
      {board && <ExerciseBoard exerciseId={exercise.id} measure={measure} version={version} />}
      {open && (
        <ExerciseRecordSheet
          exercise={{ ...exercise, measure }}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false)
            reload()
            setVersion((v) => v + 1)
          }}
        />
      )}
    </>
  )
}

export function BenchmarkRecords({ workout }: { workout: { id: string; title: string; blocks: BlockDraft[] } }) {
  const { session } = useAuth()
  const { records, reload } = useRecords(session?.user.id)
  const [open, setOpen] = useState(false)
  const [version, setVersion] = useState(0)
  const blocks = scoredBlocks(workout.title, workout.blocks)
  if (!blocks.length) return null

  const mine = records.filter((r) => r.workout_id === workout.id) as (PersonalRecord & BenchmarkRecord)[]
  const bests = bestBenchmarks(mine)
  const several = blocks.length > 1
  const labelOf = (r: PersonalRecord) => blocks.find((b) => b.block.id === r.block_id)?.label ?? r.benchmark_name
  const best = (
    <div className="flex flex-col gap-1">
      {blocks.map(({ block, label }) => {
        const r = bests.get(block.id)
        return (
          <div key={block.id} className="flex justify-between gap-2">
            {several && <span className="truncate text-zinc-400">{label}</span>}
            <b>{r ? score(r) : '—'}</b>
          </div>
        )
      })}
    </div>
  )

  return (
    <>
      <RecordsCard
        best={best}
        entries={recordEntries(mine)}
        label={(e) => e.map((r) => (several ? `${labelOf(r)} ${score(r)}` : score(r)))}
        onAdd={() => setOpen(true)}
        onChange={() => {
          reload()
          setVersion((v) => v + 1)
        }}
      />
      <BenchmarkBoard workoutId={workout.id} blocks={blocks} version={version} />
      {open && (
        <BenchmarkRecordSheet
          workoutId={workout.id}
          title={workout.title}
          blocks={blocks}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false)
            reload()
            setVersion((v) => v + 1)
          }}
        />
      )}
    </>
  )
}

type BoardRecord = { block_id: string; athlete_id: string; score_type: string; gender: string | null; date: string } & Parameters<
  typeof formatScore
>[1]

/** Box leaderboard of a benchmark, one per scored block: everyone's best, men / women apart. */
function BenchmarkBoard({ workoutId, blocks, version }: { workoutId: string; blocks: ReturnType<typeof scoredBlocks>; version: number }) {
  const { session, profile } = useAuth()
  const me = session?.user.id
  const [rows, setRows] = useState<(BoardRecord & Parameters<typeof AthleteName>[0]['profile'])[]>([])
  const [blockId, setBlockId] = useState(blocks[0].block.id)
  const [gender, setGender] = useState<Gender>((profile?.gender as Gender | null) ?? 'male')

  useEffect(() => {
    supabase
      .rpc('benchmark_board', { p_workout: workoutId })
      .then(({ data }) => setRows((data ?? []).map((r) => ({ ...emptyScore(), ...r }))))
  }, [workoutId, version])

  const block = blocks.find((b) => b.block.id === blockId) ?? blocks[0]
  const best = new Map<string, (typeof rows)[number]>()
  for (const r of rows.filter((r) => r.block_id === block.block.id)) {
    const b = best.get(r.athlete_id)
    if (!b || compareScores(block.type, r, b) < 0) best.set(r.athlete_id, r)
  }
  const byGender = (g: Gender) => [...best.values()].filter((r) => ((r.gender as Gender | null) ?? 'male') === g)

  return (
    <Card className="mt-4">
      <h2 className="mb-2 font-semibold">Classement de la box</h2>
      {blocks.length > 1 && (
        <div className="mb-3">
          <Chips options={Object.fromEntries(blocks.map((b) => [b.block.id, b.label]))} value={block.block.id} onChange={setBlockId} />
        </div>
      )}
      <GenderTabs
        value={gender}
        counts={Object.fromEntries((Object.keys(GENDERS) as Gender[]).map((g) => [g, byGender(g).length])) as Record<Gender, number>}
        onChange={setGender}
      />
      <ol className="flex flex-col gap-1 text-sm">
        {rankResults(block.type, byGender(gender)).map(({ result: r, rank }) => (
          <li key={r.athlete_id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${r.athlete_id === me ? 'bg-zinc-800' : ''}`}>
            <span className="w-6 shrink-0 text-zinc-500">{rank}</span>
            <span className="flex min-w-0 flex-1">
              <AthleteName profile={r} />
            </span>
            <b className="shrink-0">{formatScore(block.type, r)}</b>
          </li>
        ))}
        {byGender(gender).length === 0 && <li className="text-zinc-500">Aucun record.</li>}
      </ol>
    </Card>
  )
}

type ExerciseBoardRow = {
  exercise_id: string
  athlete_id: string
  rep_max: number | null
  load_kg: number | null
  value: number | null
  date: string
  gender: string | null
} & NonNullable<Parameters<typeof AthleteName>[0]['profile']>
type BoardLine = { athlete_id: string; gender: string | null; amount: number; via?: string; profile: ExerciseBoardRow }

/** Box leaderboard of a movement: everyone's best (per rep max for a lift, variants counted), men / women apart. */
function ExerciseBoard({ exerciseId, measure, version }: { exerciseId: string; measure: Measure; version: number }) {
  const { session, profile } = useAuth()
  const me = session?.user.id
  const parents = useLiftParents()
  const { nameOf } = useExercises()
  const [rows, setRows] = useState<ExerciseBoardRow[]>([])
  const [rm, setRm] = useState<number | null>(null)
  const [gender, setGender] = useState<Gender>((profile?.gender as Gender | null) ?? 'male')

  useEffect(() => {
    supabase.rpc('exercise_board', { p_exercise: exerciseId }).then(({ data }) => setRows(data ?? []))
  }, [exerciseId, version])

  const load = measure === 'load'
  const byAthlete = new Map<string, ExerciseBoardRow[]>()
  for (const r of rows) byAthlete.set(r.athlete_id, [...(byAthlete.get(r.athlete_id) ?? []), r])
  const perRm = new Map<number, BoardLine[]>()
  const maxes: BoardLine[] = []
  for (const [athlete, own] of byAthlete) {
    const p = own[0]
    if (load) {
      const lifts = own.flatMap((r) => (r.load_kg !== null && r.rep_max !== null ? [{ ...r, rep_max: r.rep_max, load_kg: r.load_kg }] : []))
      for (const [n, r] of bestLoads(withInherited(lifts, parents)).get(exerciseId) ?? [])
        perRm.set(n, [...(perRm.get(n) ?? []), { athlete_id: athlete, gender: p.gender, amount: r.load_kg, via: r.via, profile: p }])
    } else {
      const values = own.flatMap((r) => (r.exercise_id === exerciseId && r.value !== null ? [{ ...r, value: r.value }] : []))
      const best = bestMaxes(values).get(exerciseId)
      if (best) maxes.push({ athlete_id: athlete, gender: p.gender, amount: best.value, profile: p })
    }
  }
  const rms = [...perRm.keys()].sort((a, b) => a - b)
  const shownRm = rm !== null && perRm.has(rm) ? rm : rms.includes(1) ? 1 : rms[0]
  const lines = load ? (perRm.get(shownRm) ?? []) : maxes
  const byGender = (g: Gender) => lines.filter((l) => ((l.gender as Gender | null) ?? 'male') === g).sort((a, b) => b.amount - a.amount)
  const shown = byGender(gender)

  return (
    <Card className="mt-4">
      <h2 className="mb-2 font-semibold">Classement de la box</h2>
      {rms.length > 1 && (
        <div className="mb-3">
          <Chips
            options={Object.fromEntries(rms.map((n) => [String(n), `${n}RM`]))}
            value={String(shownRm)}
            onChange={(v) => setRm(Number(v))}
          />
        </div>
      )}
      <GenderTabs
        value={gender}
        counts={Object.fromEntries((Object.keys(GENDERS) as Gender[]).map((g) => [g, byGender(g).length])) as Record<Gender, number>}
        onChange={setGender}
      />
      <ol className="flex flex-col gap-1 text-sm">
        {shown.map((l) => (
          <li key={l.athlete_id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${l.athlete_id === me ? 'bg-zinc-800' : ''}`}>
            <span className="w-6 shrink-0 text-zinc-500">{1 + shown.filter((o) => o.amount > l.amount).length}</span>
            <span className="flex min-w-0 flex-1">
              <AthleteName profile={l.profile} />
            </span>
            <span className="shrink-0 text-right">
              <b>{load ? `${formatNumber(l.amount)} kg` : formatMax(measure, l.amount)}</b>
              {l.via && nameOf(l.via) && <span className="block text-xs text-zinc-500">via {nameOf(l.via)}</span>}
            </span>
          </li>
        ))}
        {shown.length === 0 && <li className="text-zinc-500">Aucun record.</li>}
      </ol>
    </Card>
  )
}
