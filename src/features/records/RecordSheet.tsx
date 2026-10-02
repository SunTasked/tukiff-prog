import { useState } from 'react'
import { DateField } from '../../components/DatePicker'
import { DurationInput, NumberInput } from '../../components/inputs'
import { Button, Chips, ErrorText, Field, Input } from '../../components/ui'
import { BenchmarkPicker } from './BenchmarkPicker'
import { MAX_LABELS, RECORD_MEASURES } from '../../domain/records'
import { emptyScore, normalizeScore, validateScore, type Score, type ScoreType } from '../../domain/scoring'
import { supabase } from '../../lib/supabase'
import { isCoach, useAuth } from '../auth/AuthProvider'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { useExercises } from '../exercises/useExercises'
import { today } from '../../domain/dates'
import type { Measure } from '../../domain/workout'

const KINDS = { load: 'Exercice', benchmark: 'Benchmark' } as const
const RM = { '1': '1RM', '2': '2RM', '3': '3RM', '5': '5RM', '10': '10RM' } as const

const input = 'w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3'
const int = (v: number | null) => (v == null ? null : Math.round(v))

/** New record: an exercise load (1RM, 3RM…), a gymnastics max (reps, hold time) or a benchmark score. */
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
  const [pickingBench, setPickingBench] = useState(false)
  const [rm, setRm] = useState<keyof typeof RM>('1')
  const [load, setLoad] = useState<number | null>(null)
  const [value, setValue] = useState<number | null>(null)
  const [bench, setBench] = useState('')
  const [benchType, setBenchType] = useState<ScoreType>('time')
  const [score, setScore] = useState<Score>(emptyScore())
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const measure = (exercises.find((e) => e.id === exerciseId)?.measure ?? 'load') as Measure

  async function save() {
    let row
    if (kind === 'load') {
      if (!exerciseId) return setError('Choisis un exercice.')
      if (measure === 'load') {
        if (!load) return setError('Indique la charge.')
        row = { exercise_id: exerciseId, rep_max: Number(rm), load_kg: load }
      } else {
        if (!value) return setError('Indique ton record.')
        row = { exercise_id: exerciseId, value }
      }
    } else {
      if (!bench.trim()) return setError('Choisis un benchmark.')
      const invalid = validateScore(benchType, score)
      if (invalid) return setError(invalid)
      const s = normalizeScore(benchType, score)
      row = { benchmark_name: bench.trim(), score_type: benchType, time_s: s.time_s, rounds: s.rounds, reps: s.reps, load_kg: s.load_kg }
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
            {measure === 'load' ? (
              <>
                <Chips options={RM} value={rm} onChange={setRm} />
                <Field label="Charge (kg)">
                  <NumberInput value={load} onChange={setLoad} />
                </Field>
              </>
            ) : (
              <Field label={MAX_LABELS[measure === 'time' ? 'time' : 'reps']}>
                {measure === 'time' ? (
                  <DurationInput value={value} onChange={setValue} />
                ) : (
                  <NumberInput value={value} onChange={(v) => setValue(measure === 'reps' ? int(v) : v)} />
                )}
              </Field>
            )}
          </>
        ) : (
          <>
            <button className={`${input} text-left`} onClick={() => setPickingBench(true)}>
              {bench || <span className="text-zinc-500">Choisir un benchmark</span>}
            </button>
            {bench && benchType === 'time' && (
              <Field label="Temps">
                <DurationInput value={score.time_s} onChange={(v) => setScore({ ...score, time_s: v })} />
              </Field>
            )}
            {bench && benchType === 'rounds_reps' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rounds">
                  <NumberInput value={score.rounds} onChange={(v) => setScore({ ...score, rounds: int(v) })} />
                </Field>
                <Field label="+ reps">
                  <NumberInput value={score.reps} onChange={(v) => setScore({ ...score, reps: int(v) })} />
                </Field>
              </div>
            )}
            {bench && benchType === 'reps' && (
              <Field label="Reps">
                <NumberInput value={score.reps} onChange={(v) => setScore({ ...score, reps: int(v) })} />
              </Field>
            )}
            {bench && benchType === 'load' && (
              <Field label="Charge (kg)">
                <NumberInput value={score.load_kg} onChange={(v) => setScore({ ...score, load_kg: v })} />
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
      {pickingBench && (
        <BenchmarkPicker
          onPick={(b) => {
            setBench(b.name)
            setBenchType(b.score_type)
            setScore(emptyScore())
            setPickingBench(false)
          }}
          onClose={() => setPickingBench(false)}
        />
      )}
      {picking && (
        <ExercisePicker
          exercises={exercises.filter((e) => RECORD_MEASURES.includes(e.measure as Measure))}
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
