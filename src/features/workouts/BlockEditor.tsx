import { DurationPicker, NumberInput } from '../../components/inputs'
import { Chips, Field, SmallInput } from '../../components/ui'
import {
  BLOCK_KINDS,
  DEFAULT_FORMAT,
  FORMATS,
  defaultParams,
  type AltLevel,
  type BlockDraft,
  type BlockKind,
  type Format,
  type FormatParams,
  type Measure,
} from '../../domain/workout'
import type { Exercise } from '../../lib/supabase'
import { ItemEditor } from './ItemEditor'

type Props = {
  block: BlockDraft
  index: number
  count: number
  byId: Map<string, Exercise>
  nameOf: (id: string) => string | undefined
  onChange: (b: BlockDraft) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
  onPick: (itemIndex: number | null, level?: AltLevel) => void
}

const int = (v: number | null) => (v == null ? undefined : Math.round(v))

export function BlockEditor({ block, index, count, byId, nameOf, onChange, onMove, onRemove, onPick }: Props) {
  const set = (patch: Partial<BlockDraft>) => onChange({ ...block, ...patch })
  const setParams = (patch: Partial<FormatParams>) => set({ params: { ...block.params, ...patch } })

  function setKind(kind: BlockKind) {
    // Switching kind on an untouched block also switches to that kind's usual format.
    if (block.items.length === 0) {
      const format = DEFAULT_FORMAT[kind]
      set({ kind, format, params: defaultParams(format) })
    } else set({ kind })
  }
  const setFormat = (format: Format) => set({ format, params: defaultParams(format) })
  const p = block.params

  return (
    <section className="rounded-2xl bg-zinc-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-zinc-400">Bloc {String.fromCharCode(65 + index)}</span>
        <div className="flex gap-1 text-zinc-400">
          <button type="button" className="px-2 py-1 disabled:opacity-30" disabled={index === 0} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button
            type="button"
            className="px-2 py-1 disabled:opacity-30"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button type="button" className="px-2 py-1 text-red-400" onClick={onRemove}>
            ✕
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Chips options={BLOCK_KINDS} value={block.kind} onChange={setKind} />
        <Chips options={FORMATS} value={block.format} onChange={setFormat} />

        <div className="grid grid-cols-3 gap-2">
          {block.format === 'for_time' && (
            <>
              <Field label="Rounds">
                <NumberInput value={p.rounds} onChange={(v) => setParams({ rounds: int(v) })} />
              </Field>
              <Field label="Time cap" className="col-span-2">
                <DurationPicker value={p.time_cap_s} onChange={(v) => setParams({ time_cap_s: v ?? undefined })} />
              </Field>
            </>
          )}
          {block.format === 'amrap' && (
            <Field label="Durée" className="col-span-2">
              <DurationPicker value={p.duration_s} onChange={(v) => setParams({ duration_s: v ?? undefined })} />
            </Field>
          )}
          {block.format === 'emom' && (
            <>
              <Field label="Toutes les" className="col-span-2">
                <DurationPicker value={p.interval_s} onChange={(v) => setParams({ interval_s: v ?? undefined })} />
              </Field>
              <Field label="Rounds">
                <NumberInput value={p.rounds} onChange={(v) => setParams({ rounds: int(v) })} />
              </Field>
            </>
          )}
          {block.format === 'tabata' && (
            <>
              <Field label="Rounds">
                <NumberInput value={p.rounds} onChange={(v) => setParams({ rounds: int(v) })} />
              </Field>
              <Field label="Travail (s)">
                <NumberInput value={p.work_s} onChange={(v) => setParams({ work_s: int(v) })} />
              </Field>
              <Field label="Repos (s)">
                <NumberInput value={p.rest_s} onChange={(v) => setParams({ rest_s: int(v) })} />
              </Field>
            </>
          )}
          {block.format === 'sets_reps' && (
            <Field label="Séries">
              <NumberInput value={p.sets} onChange={(v) => setParams({ sets: int(v) })} />
            </Field>
          )}
          <Field label="Titre (option)" className={['tabata', 'for_time', 'emom'].includes(block.format) ? 'col-span-3' : 'col-span-1'}>
            <SmallInput placeholder="Fran…" value={block.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
        </div>

        {block.items.map((item, i) => (
          <ItemEditor
            key={i}
            item={item}
            measure={item.exercise_id ? (byId.get(item.exercise_id)?.measure as Measure) : undefined}
            nameOf={nameOf}
            onChange={(it) => set({ items: block.items.map((x, j) => (j === i ? it : x)) })}
            onRemove={() => set({ items: block.items.filter((_, j) => j !== i) })}
            onDuplicate={() => set({ items: block.items.toSpliced(i + 1, 0, structuredClone(item)) })}
            onPick={(level) => onPick(i, level)}
          />
        ))}
        <button
          type="button"
          className="rounded-xl border border-dashed border-zinc-700 py-2 text-sm text-zinc-300"
          onClick={() => onPick(null)}
        >
          + Mouvement
        </button>

        <Field label="Notes du bloc">
          <textarea
            rows={2}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 outline-none focus:border-lime-400"
            value={block.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>
      </div>
    </section>
  )
}
