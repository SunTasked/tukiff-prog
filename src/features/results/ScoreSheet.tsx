import { useState } from 'react'
import { DurationInput, NumberInput } from '../../components/inputs'
import { Button, ErrorText, Field, Textarea } from '../../components/ui'
import { emptyScore, formatScore, normalizeScore, parseGuests, validateScore, type Score, type ScoreType, type TeamGuest } from '../../domain/scoring'
import type { BlockDraft } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
import { RepCounter } from './RepCounter'
import { TeamPicker, type Teammate } from './TeamPicker'
import type { ResultRow } from './useWorkoutResults'

type Props = {
  /** Time cap in seconds: a time above it is refused. */
  timeCap?: number
  workoutId: string
  blockId: string
  blockLabel: string
  type: ScoreType
  /** The block, for the reps counter of AMRAPs scored in reps. */
  block?: BlockDraft
  /** Ranked block: the "RX" box is offered (unticked = scaled, not ranked). */
  ranked: boolean
  existing: ResultRow | undefined
  /** Team block: my teammates' rows (same team_id as mine), entered and deleted together. */
  team?: { size: number; rows: ResultRow[] }
  onClose: () => void
  onSaved: () => void
}

const int = (v: number | null) => (v == null ? null : Math.round(v))


export function ScoreSheet({ timeCap, workoutId, blockId, blockLabel, type, block, ranked, existing, team, onClose, onSaved }: Props) {
  const [score, setScore] = useState<Score>(existing ?? emptyScore())
  const [rx, setRx] = useState(existing?.rx ?? true)
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [members, setMembers] = useState<Teammate[]>(() =>
    (team?.rows ?? []).map((r) => ({ id: r.athlete_id, avatar_url: null, first_name: null, last_name: null, display_name: null, gender: null, ...r.profiles })),
  )
  const [guests, setGuests] = useState<TeamGuest[]>(() => parseGuests(existing?.team_guests))
  const set = (patch: Partial<Score>) => setScore({ ...score, ...patch })

  async function save() {
    const invalid = validateScore(type, score)
    if (invalid) return setError(invalid)
    if (type === 'time' && !score.capped && timeCap && score.time_s! > timeCap)
      return setError('Ton temps dépasse le time cap : coche « Time cap atteint ».')
    if (team && members.length + guests.length === 0) return setError('Ajoute tes équipiers.')
    setBusy(true)
    const row = { ...normalizeScore(type, score), rx: !ranked || rx, comment: comment.trim() || null }
    const { error } = team
      ? await supabase.rpc('save_team_result', {
          p_block: blockId,
          p_team: existing?.team_id ?? null,
          p_members: members.map((m) => m.id),
          p_guests: guests,
          p_time_s: row.time_s,
          p_capped: row.capped,
          p_rounds: row.rounds,
          p_reps: row.reps,
          p_load_kg: row.load_kg,
          p_rx: row.rx,
          p_comment: row.comment,
        })
      : existing
      ? await supabase.from('results').update(row).eq('id', existing.id)
      : await supabase.from('results').insert({ ...row, workout_id: workoutId, block_id: blockId })
    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  async function remove() {
    if (!existing || !confirm(existing.team_id ? 'Supprimer le score de toute l’équipe ?' : 'Supprimer ton score ?')) return
    const { error } = existing.team_id
      ? await supabase.rpc('delete_team_result', { p_team: existing.team_id })
      : await supabase.from('results').delete().eq('id', existing.id)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between border-b border-zinc-800 p-3">
        <span className="min-w-0 truncate font-semibold">{team ? 'Score d’équipe' : 'Mon score'} · {blockLabel}</span>
        <button className="px-2 text-zinc-400" onClick={onClose}>
          Annuler
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {team && (
          <TeamPicker
            blockId={blockId}
            size={team.size}
            members={members}
            guests={guests}
            onChange={(m, g) => {
              setMembers(m)
              setGuests(g)
            }}
          />
        )}

        {block?.params.score_note && <p className="text-sm text-zinc-400">{block.params.score_note}</p>}

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
                <DurationInput value={score.time_s} onChange={(v) => set({ time_s: v })} />
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
        {type === 'reps' && block?.format === 'amrap' && <RepCounter block={block} onTotal={(reps) => set({ reps })} />}
        {type === 'reps' && (
          <Field label="Reps totales">
            <NumberInput value={score.reps} onChange={(v) => set({ reps: int(v) })} />
          </Field>
        )}
        {type !== 'none' && (
          <p className="rounded-xl bg-zinc-900 px-3 py-2 text-sm text-zinc-400">
            {team ? 'Le score' : 'Ton score'} s’affichera : <span className="font-semibold text-zinc-100">{formatScore(type, normalizeScore(type, score))}</span>
          </p>
        )}

        {ranked && (
          <label className="flex items-center gap-3">
            <input type="checkbox" className="size-5 accent-lime-400" checked={rx} onChange={(e) => setRx(e.target.checked)} />
            <span className="font-semibold">RX</span>
            {!rx && <span className="text-sm text-zinc-400">Adapté : non classé</span>}
          </label>
        )}

        <Textarea label="Commentaire" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
        <ErrorText>{error}</ErrorText>
        <Button disabled={busy} onClick={save}>
          {type === 'none' && !existing ? 'Marquer comme fait' : 'Enregistrer'}
        </Button>
        {existing && (
          <button className="py-2 text-sm text-red-400 underline" onClick={remove}>
            {existing.team_id ? 'Supprimer le score de l’équipe' : 'Supprimer mon score'}
          </button>
        )}
      </div>
    </div>
  )
}
