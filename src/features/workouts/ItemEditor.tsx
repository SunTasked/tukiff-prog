import { useState } from 'react'
import { DurationPicker, NumberInput } from '../../components/inputs'
import { Field, SmallInput } from '../../components/ui'
import {
  ALT_LEVELS,
  LEVELS,
  hasOverride,
  type AltLevel,
  type ItemDraft,
  type LevelOverride,
  type Measure,
} from '../../domain/workout'

type Props = {
  item: ItemDraft
  measure: Measure | undefined
  nameOf: (id: string) => string | undefined
  onChange: (item: ItemDraft) => void
  onRemove: () => void
  /** Opens the exercise picker for the item itself (level undefined) or a level substitution. */
  onPick: (level?: AltLevel) => void
}

export function ItemEditor({ item, measure, nameOf, onChange, onRemove, onPick }: Props) {
  const [expanded, setExpanded] = useState(false)
  const set = (patch: Partial<ItemDraft>) => onChange({ ...item, ...patch })
  const show = (m: Measure, value: unknown) => expanded || measure === m || value != null

  function setOverride(level: AltLevel, patch: Partial<LevelOverride>) {
    const next: LevelOverride = { ...item.levels[level], ...patch }
    for (const k of Object.keys(next) as (keyof LevelOverride)[]) {
      if (next[k] === undefined || next[k] === '') delete next[k]
    }
    const levels = { ...item.levels }
    if (hasOverride(next)) levels[level] = next
    else delete levels[level]
    set({ levels })
  }

  const levelCount = ALT_LEVELS.filter((l) => hasOverride(item.levels[l])).length

  return (
    <div className="rounded-xl border border-zinc-800 p-3">
      <div className="flex items-center gap-2">
        <button type="button" className="min-w-0 flex-1 truncate text-left font-semibold" onClick={() => onPick()}>
          {(item.exercise_id && nameOf(item.exercise_id)) || item.label || 'Choisir un exercice'}
        </button>
        <button type="button" aria-label="Retirer" className="-m-2 p-2 text-zinc-500" onClick={onRemove}>
          ✕
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Field label="Reps">
          <SmallInput placeholder="21-15-9" value={item.reps} onChange={(e) => set({ reps: e.target.value })} />
        </Field>
        {show('load', item.load_kg) && (
          <Field label="Charge (kg)">
            <NumberInput value={item.load_kg} onChange={(v) => set({ load_kg: v })} />
          </Field>
        )}
        {show('load', item.pct_1rm) && (
          <Field label="% 1RM">
            <NumberInput value={item.pct_1rm} onChange={(v) => set({ pct_1rm: v })} />
          </Field>
        )}
        {show('distance', item.distance_m) && (
          <Field label="Distance (m)">
            <NumberInput value={item.distance_m} onChange={(v) => set({ distance_m: v })} />
          </Field>
        )}
        {show('calories', item.calories) && (
          <Field label="Calories">
            <NumberInput value={item.calories} onChange={(v) => set({ calories: v })} />
          </Field>
        )}
        {show('time', item.duration_s) && (
          <Field label="Durée" className="col-span-2">
            <DurationPicker value={item.duration_s} onChange={(v) => set({ duration_s: v })} />
          </Field>
        )}
      </div>

      {expanded && (
        <>
          <Field label="Note" className="mt-2">
            <SmallInput value={item.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
          <p className="mt-3 text-xs text-zinc-500">Niveaux (seulement ce qui diffère du RX)</p>
          {ALT_LEVELS.map((level) => {
            const o = item.levels[level] ?? {}
            return (
              <div key={level} className="mt-2 rounded-lg bg-zinc-950 p-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{LEVELS[level]}</span>
                  <button type="button" className="truncate text-lime-400" onClick={() => onPick(level)}>
                    {o.exercise_id ? `→ ${nameOf(o.exercise_id)}` : 'Remplacer l’exercice'}
                  </button>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  <Field label="Reps">
                    <SmallInput value={o.reps ?? ''} onChange={(e) => setOverride(level, { reps: e.target.value })} />
                  </Field>
                  <Field label="Charge (kg)">
                    <NumberInput value={o.load_kg} onChange={(v) => setOverride(level, { load_kg: v ?? undefined })} />
                  </Field>
                  <Field label="Note">
                    <SmallInput value={o.note ?? ''} onChange={(e) => setOverride(level, { note: e.target.value })} />
                  </Field>
                </div>
                {o.exercise_id && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-zinc-500 underline"
                    onClick={() => setOverride(level, { exercise_id: undefined })}
                  >
                    Annuler le remplacement
                  </button>
                )}
              </div>
            )
          })}
        </>
      )}

      <button type="button" className="mt-2 text-xs text-zinc-400" onClick={() => setExpanded(!expanded)}>
        {expanded ? '▴ Moins' : `▾ Plus (note, niveaux${levelCount ? ` · ${levelCount}` : ''})`}
      </button>
    </div>
  )
}
