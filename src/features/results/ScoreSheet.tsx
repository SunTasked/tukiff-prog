import { useState } from 'react'
import { DurationPicker, NumberInput } from '../../components/inputs'
import { Button, Chips, ErrorText, Field, Textarea } from '../../components/ui'
import { SCORE_HINTS, emptyScore, formatScore, normalizeScore, validateScore, type Score, type ScoreType } from '../../domain/scoring'
import { LEVELS, type Level } from '../../domain/workout'
import { getItem } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import type { ResultRow } from './useWorkoutResults'

type Props = {
  /** Time cap in seconds, bounds the minutes picker. */
  timeCap?: number
  workoutId: string
  blockId: string
  blockLabel: string
  type: ScoreType
  /** Levels offered for this block (RX + those defined by the coach). */
  levels: Level[]
  existing: ResultRow | undefined
  onClose: () => void
  onSaved: () => void
}

const int = (v: number | null) => (v == null ? null : Math.round(v))


export function ScoreSheet({ timeCap, workoutId, blockId, blockLabel, type, levels, existing, onClose, onSaved }: Props) {
  const [score, setScore] = useState<Score>(existing ?? emptyScore())
  const [level, setLevel] = useState<Level>(() => {
    const preferred = (existing?.level ?? getItem('level')) as Level | null
    return preferred && levels.includes(preferred) ? preferred : 'rx'
  })
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<Score>) => setScore({ ...score, ...patch })
  const maxMinutes = timeCap ? Math.ceil(timeCap / 60) : 99

  async function save() {
    const invalid = validateScore(type, score)
    if (invalid) return setError(invalid)
    setBusy(true)
    const row = { ...normalizeScore(type, score), level, comment: comment.trim() || null }
    const { error } = existing
      ? await supabase.from('results').update(row).eq('id', existing.id)
      : await supabase.from('results').insert({ ...row, workout_id: workoutId, block_id: blockId })
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  async function remove() {
    if (!existing || !confirm('Supprimer ton score ?')) return
    const { error } = await supabase.from('results').delete().eq('id', existing.id)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between border-b border-zinc-800 p-3">
        <span className="font-semibold">Mon score · {blockLabel}</span>
        <button className="px-2 text-zinc-400" onClick={onClose}>
          Annuler
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {levels.length > 1 && (
          <Chips
            options={Object.fromEntries(levels.map((l) => [l, LEVELS[l]])) as Record<Level, string>}
            value={level}
            onChange={setLevel}
          />
        )}

        {type !== 'none' && <p className="text-sm text-zinc-400">{SCORE_HINTS[type]}</p>}

        {type === 'time' && (
          <>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-lime-400"
                checked={score.capped}
                onChange={(e) => set({ capped: e.target.checked })}
              />
              <span>Time cap atteint</span>
            </label>
            {score.capped ? (
              <Field label="Reps faites au cap">
                <NumberInput value={score.reps} onChange={(v) => set({ reps: int(v) })} />
              </Field>
            ) : (
              <Field label="Temps">
                <DurationPicker value={score.time_s} onChange={(v) => set({ time_s: v })} size="lg" maxMinutes={maxMinutes} />
              </Field>
            )}
          </>
        )}
        {type === 'rounds_reps' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rounds">
              <NumberInput value={score.rounds} onChange={(v) => set({ rounds: int(v) })} />
            </Field>
            <Field label="+ reps">
              <NumberInput value={score.reps} onChange={(v) => set({ reps: int(v) })} />
            </Field>
          </div>
        )}
        {type === 'load' && (
          <Field label="Charge max (kg)">
            <NumberInput value={score.load_kg} onChange={(v) => set({ load_kg: v })} />
          </Field>
        )}
        {type === 'reps' && (
          <Field label="Reps totales">
            <NumberInput value={score.reps} onChange={(v) => set({ reps: int(v) })} />
          </Field>
        )}
        {type === 'none' ? (
          <p className="text-sm text-zinc-400">{SCORE_HINTS.none}</p>
        ) : (
          <p className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-zinc-400">
            Ton score s’affichera : <span className="font-semibold text-zinc-100">{formatScore(type, normalizeScore(type, score))}</span>
          </p>
        )}

        <Textarea label="Commentaire" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
        <ErrorText>{error}</ErrorText>
        <Button disabled={busy} onClick={save}>
          {type === 'none' ? 'Marquer comme fait' : 'Enregistrer'}
        </Button>
        {existing && (
          <button className="py-2 text-sm text-red-400 underline" onClick={remove}>
            Supprimer mon score
          </button>
        )}
      </div>
    </div>
  )
}
