import { useState } from 'react'
import { DateField } from '../../components/DatePicker'
import { DurationPicker, NumberInput } from '../../components/inputs'
import { Button, Chips, ErrorText, Field, Input } from '../../components/ui'
import { BENCHMARKS } from '../../domain/records'
import { emptyScore, normalizeScore, validateScore, type Score } from '../../domain/scoring'
import { supabase } from '../../lib/supabase'
import { isCoach, useAuth } from '../auth/AuthProvider'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { useExercises } from '../exercises/useExercises'
import { today } from '../../domain/dates'

const KINDS = { load: 'Charge', benchmark: 'Benchmark' } as const
const RM = { '1': '1RM', '2': '2RM', '3': '3RM', '5': '5RM', '10': '10RM' } as const
const BENCH_TYPES = { time: 'Temps', rounds_reps: 'Rounds + reps', reps: 'Reps' } as const
type BenchType = keyof typeof BENCH_TYPES

const input = 'w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3'
const int = (v: number | null) => (v == null ? null : Math.round(v))

/** New record: an exercise load (1RM, 3RM…) or a benchmark score. */
export function RecordSheet({
  initialExercise,
  onClose,
  onSaved,
}: {
  initialExercise?: string
  onClose: () => void
  onSaved: () => void
}) {
  const { profile } = useAuth()
  const { exercises, sections, nameOf, create } = useExercises()
  const [kind, setKind] = useState<keyof typeof KINDS>('load')
  const [exerciseId, setExerciseId] = useState<string | null>(initialExercise ?? null)
  const [picking, setPicking] = useState(false)
  const [rm, setRm] = useState<keyof typeof RM>('1')
  const [load, setLoad] = useState<number | null>(null)
  const [bench, setBench] = useState('')
  const [benchType, setBenchType] = useState<BenchType>('time')
  const [score, setScore] = useState<Score>(emptyScore())
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  async function save() {
    let row
    if (kind === 'load') {
      if (!exerciseId) return setError('Choisis un exercice.')
      if (!load) return setError('Indique la charge.')
      row = { exercise_id: exerciseId, rep_max: Number(rm), load_kg: load }
    } else {
      if (!bench.trim()) return setError('Indique le nom du benchmark.')
      const invalid = validateScore(benchType, score)
      if (invalid) return setError(invalid)
      const s = normalizeScore(benchType, score)
      row = { benchmark_name: bench.trim(), score_type: benchType, time_s: s.time_s, rounds: s.rounds, reps: s.reps }
    }
    const { error } = await supabase.from('personal_records').insert({ ...row, date, notes: notes.trim() || null })
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-zinc-950 lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between border-b border-zinc-800 p-3">
        <span className="font-semibold">Nouveau record</span>
        <button className="px-2 text-zinc-400" onClick={onClose}>
          Annuler
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Chips options={KINDS} value={kind} onChange={setKind} />

        {kind === 'load' ? (
          <>
            <button className={`${input} text-left`} onClick={() => setPicking(true)}>
              {exerciseId ? nameOf(exerciseId) : <span className="text-zinc-500">Choisir un exercice</span>}
            </button>
            <Chips options={RM} value={rm} onChange={setRm} />
            <Field label="Charge (kg)">
              <NumberInput value={load} onChange={setLoad} />
            </Field>
          </>
        ) : (
          <>
            <Input label="Benchmark" list="benchmarks" value={bench} onChange={(e) => setBench(e.target.value)} />
            <datalist id="benchmarks">
              {BENCHMARKS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
            <Chips options={BENCH_TYPES} value={benchType} onChange={setBenchType} />
            {benchType === 'time' && (
              <Field label="Temps">
                <DurationPicker size="lg" value={score.time_s} onChange={(v) => setScore({ ...score, time_s: v })} />
              </Field>
            )}
            {benchType === 'rounds_reps' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rounds">
                  <NumberInput value={score.rounds} onChange={(v) => setScore({ ...score, rounds: int(v) })} />
                </Field>
                <Field label="+ reps">
                  <NumberInput value={score.reps} onChange={(v) => setScore({ ...score, reps: int(v) })} />
                </Field>
              </div>
            )}
            {benchType === 'reps' && (
              <Field label="Reps">
                <NumberInput value={score.reps} onChange={(v) => setScore({ ...score, reps: int(v) })} />
              </Field>
            )}
          </>
        )}

        <div>
          <span className="mb-0.5 block text-xs text-zinc-500">Date</span>
          <DateField value={date} max={today()} onChange={setDate} />
        </div>
        <Input label="Note" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <ErrorText>{error}</ErrorText>
        <Button onClick={save}>Enregistrer</Button>
      </div>
      {picking && (
        <ExercisePicker
          exercises={exercises}
          sections={sections}
          onPick={(e) => {
            setExerciseId(e.id)
            setPicking(false)
          }}
          onCreate={isCoach(profile) ? (n) => create(n, 'load') : undefined}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
