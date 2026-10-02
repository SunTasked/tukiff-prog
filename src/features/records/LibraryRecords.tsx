import { useEffect, useState, type ReactNode } from 'react'
import { Button, Card, Chips } from '../../components/ui'
import { formatDay } from '../../domain/dates'
import {
  bestBenchmarks,
  bestLoads,
  bestMaxes,
  formatMax,
  recordEntries,
  RECORD_MEASURES,
  type BenchmarkRecord,
  type LoadRecord,
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
import { useRecords } from './useRecords'

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
}: {
  exercise: { id: string; name: string; measure: string }
  adding?: boolean
}) {
  const { session } = useAuth()
  const { records, reload } = useRecords(session?.user.id)
  const [open, setOpen] = useState(adding)
  const measure = exercise.measure as Measure
  if (!RECORD_MEASURES.includes(measure)) return null

  const mine = records.filter((r) => r.exercise_id === exercise.id)
  const load = measure === 'load'
  const loads = mine.filter((r): r is PersonalRecord & LoadRecord => r.load_kg !== null)
  const maxes = mine.filter((r): r is PersonalRecord & MaxRecord => r.value !== null)
  const byRm = bestLoads(loads).get(exercise.id)
  const bestMax = bestMaxes(maxes).get(exercise.id)
  const best = load ? (
    <div className="flex flex-wrap gap-3">
      {[...(byRm ?? new Map()).entries()]
        .sort(([a], [b]) => a - b)
        .map(([rm, r]) => (
          <span key={rm}>
            <span className="text-zinc-500">{rm}RM</span> <b>{formatNumber(r.load_kg)} kg</b>
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
        onChange={reload}
      />
      {open && (
        <ExerciseRecordSheet
          exercise={{ ...exercise, measure }}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false)
            reload()
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
