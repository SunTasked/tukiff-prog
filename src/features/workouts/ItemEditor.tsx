import { useState } from 'react'
import { DurationPicker, NumberInput } from '../../components/inputs'
import { Field, SmallInput } from '../../components/ui'
import type { ItemDraft, Measure } from '../../domain/workout'

type Props = {
  item: ItemDraft
  measure: Measure | undefined
  nameOf: (id: string) => string | undefined
  onChange: (item: ItemDraft) => void
  onRemove: () => void
  onDuplicate: () => void
  /** Opens the exercise picker for the item. */
  onPick: () => void
}

export function ItemEditor({ item, measure, nameOf, onChange, onRemove, onDuplicate, onPick }: Props) {
  const [expanded, setExpanded] = useState(false)
  const set = (patch: Partial<ItemDraft>) => onChange({ ...item, ...patch })
  const show = (m: Measure, value: unknown) => expanded || measure === m || value != null

  return (
    <div className="rounded-xl border border-zinc-800 p-3">
      <div className="flex items-center gap-2">
        <button type="button" className="min-w-0 flex-1 truncate text-left font-semibold" onClick={() => onPick()}>
          {(item.exercise_id && nameOf(item.exercise_id)) || item.label || 'Choisir un exercice'}
        </button>
        <button type="button" aria-label="Dupliquer" title="Dupliquer" className="-my-2 p-2 text-zinc-500" onClick={onDuplicate}>
          ⧉
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
          <Field label={item.load_kg_f != null ? 'Charge H (kg)' : 'Charge (kg)'}>
            <NumberInput value={item.load_kg} onChange={(v) => set({ load_kg: v })} />
          </Field>
        )}
        {/* Women's load, offered once an absolute load is set. */}
        {(item.load_kg != null || item.load_kg_f != null) && (
          <Field label="Charge F (kg)">
            <NumberInput placeholder="idem" value={item.load_kg_f} onChange={(v) => set({ load_kg_f: v })} />
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
        <Field label="Note" className="mt-2">
          <SmallInput value={item.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      )}

      <button type="button" className="mt-2 text-xs text-zinc-400" onClick={() => setExpanded(!expanded)}>
        {expanded ? '▴ Moins' : '▾ Plus (note)'}
      </button>
    </div>
  )
}
