import { useState, type ReactNode } from 'react'
import { DateField } from '../../components/DatePicker'
import { DurationInput, NumberInput } from '../../components/inputs'
import { Button, Chips, ErrorText, Field, Input } from '../../components/ui'
import { today } from '../../domain/dates'
import { MAX_LABELS } from '../../domain/records'
import { emptyScore, normalizeScore, scoreType, validateScore, type Score, type ScoreType } from '../../domain/scoring'
import { blockName, type BlockDraft, type Measure } from '../../domain/workout'
import { supabase } from '../../lib/supabase'

const RM = { '1': '1RM', '2': '2RM', '3': '3RM', '5': '5RM', '10': '10RM' } as const
const int = (v: number | null) => (v == null ? null : Math.round(v))

function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-zinc-950 lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 p-3">
        <span className="truncate font-semibold">{title}</span>
        <button className="px-2 text-zinc-400" onClick={onClose}>
          Annuler
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
    </div>
  )
}

/** Date + note + save, shared by both forms. */
function Footer({
  date,
  setDate,
  notes,
  setNotes,
  error,
  busy,
  onSave,
}: {
  date: string
  setDate: (d: string) => void
  notes: string
  setNotes: (n: string) => void
  error: string
  busy: boolean
  onSave: () => void
}) {
  return (
    <>
      <div>
        <span className="mb-0.5 block text-xs text-zinc-500">Date</span>
        <DateField value={date} max={today()} onChange={setDate} />
      </div>
      <Input label="Note" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <Button disabled={busy} onClick={onSave}>
        Enregistrer
      </Button>
    </>
  )
}

function ScoreFields({ type, score, onChange }: { type: ScoreType; score: Score; onChange: (s: Score) => void }) {
  const set = (patch: Partial<Score>) => onChange({ ...score, ...patch })
  if (type === 'time')
    return (
      <Field label="Temps">
        <DurationInput value={score.time_s} onChange={(v) => set({ time_s: v })} />
      </Field>
    )
  if (type === 'rounds_reps')
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rounds">
          <NumberInput value={score.rounds} onChange={(v) => set({ rounds: int(v) })} />
        </Field>
        <Field label="+ reps">
          <NumberInput value={score.reps} onChange={(v) => set({ reps: int(v) })} />
        </Field>
      </div>
    )
  if (type === 'load')
    return (
      <Field label="Charge (kg)">
        <NumberInput value={score.load_kg} onChange={(v) => set({ load_kg: v })} />
      </Field>
    )
  return (
    <Field label="Reps">
      <NumberInput value={score.reps} onChange={(v) => set({ reps: int(v) })} />
    </Field>
  )
}

/** Weightlifting: rep max + kg. Gymnastics: one best value (reps or hold time). */
export function ExerciseRecordSheet({
  exercise,
  onClose,
  onSaved,
}: {
  exercise: { id: string; name: string; measure: Measure }
  onClose: () => void
  onSaved: () => void
}) {
  const [rm, setRm] = useState<keyof typeof RM>('1')
  const [value, setValue] = useState<number | null>(null)
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = exercise.measure === 'load'

  async function save() {
    if (!value) return setError(load ? 'Indique la charge.' : 'Indique ton record.')
    setBusy(true)
    const row = load ? { rep_max: Number(rm), load_kg: value } : { value }
    const { error } = await supabase
      .from('personal_records')
      .insert({ exercise_id: exercise.id, ...row, date, notes: notes.trim() || null })
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Sheet title={exercise.name} onClose={onClose}>
      {load && <Chips options={RM} value={rm} onChange={setRm} />}
      <Field label={load ? 'Charge (kg)' : MAX_LABELS[exercise.measure === 'time' ? 'time' : 'reps']}>
        {exercise.measure === 'time' ? (
          <DurationInput value={value} onChange={setValue} />
        ) : (
          <NumberInput value={value} onChange={(v) => setValue(exercise.measure === 'reps' ? int(v) : v)} />
        )}
      </Field>
      <Footer date={date} setDate={setDate} notes={notes} setNotes={setNotes} error={error} busy={busy} onSave={save} />
    </Sheet>
  )
}

/** Scored blocks of a library session, with the name their records keep (the session's, plus the block's when several). */
export function scoredBlocks(title: string, blocks: BlockDraft[]) {
  const scored = blocks.filter((b) => scoreType(b.format, b.params) !== 'none')
  return scored.map((b) => ({
    block: b,
    type: scoreType(b.format, b.params),
    label: blockName(b),
    name: scored.length > 1 ? `${title} · ${blockName(b)}` : title,
  }))
}

/** One entry for all the scored blocks of a benchmark, entered together. */
export function BenchmarkRecordSheet({
  workoutId,
  title,
  blocks,
  onClose,
  onSaved,
}: {
  workoutId: string
  title: string
  blocks: ReturnType<typeof scoredBlocks>
  onClose: () => void
  onSaved: () => void
}) {
  const [scores, setScores] = useState<Score[]>(() => blocks.map(emptyScore))
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    for (const [i, b] of blocks.entries()) {
      const invalid = validateScore(b.type, scores[i])
      if (invalid) return setError(blocks.length > 1 ? `${b.label} : ${invalid}` : invalid)
    }
    setBusy(true)
    const entry_id = crypto.randomUUID()
    const rows = blocks.map((b, i) => {
      const s = normalizeScore(b.type, scores[i])
      return {
        entry_id,
        workout_id: workoutId,
        block_id: b.block.id,
        benchmark_name: b.name,
        score_type: b.type,
        time_s: s.time_s,
        rounds: s.rounds,
        reps: s.reps,
        load_kg: s.load_kg,
        date,
        notes: notes.trim() || null,
      }
    })
    const { error } = await supabase.from('personal_records').insert(rows)
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <Sheet title={title} onClose={onClose}>
      {blocks.map((b, i) => (
        <div key={b.block.id} className="flex flex-col gap-2">
          {blocks.length > 1 && <span className="font-semibold">{b.label}</span>}
          <ScoreFields type={b.type} score={scores[i]} onChange={(s) => setScores(scores.map((x, j) => (j === i ? s : x)))} />
        </div>
      ))}
      <Footer date={date} setDate={setDate} notes={notes} setNotes={setNotes} error={error} busy={busy} onSave={save} />
    </Sheet>
  )
}
