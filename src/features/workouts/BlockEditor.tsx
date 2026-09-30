import { DurationPicker, NumberInput } from '../../components/inputs'
import { Chips, Field, SmallInput } from '../../components/ui'
import { SCORE_TYPES, defaultScoreType, scoreType, type ScoreType } from '../../domain/scoring'
import {
  BLOCK_KINDS,
  blockSettings,
  levelName,
  DEFAULT_FORMAT,
  FORMATS,
  defaultParams,
  itemRuns,
  removeGroup,
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
  /** itemIndex null = new item, appended to the block or to sub-block `group`. */
  onPick: (itemIndex: number | null, level?: AltLevel, group?: number | null) => void
  /** Names of the program's access levels. */
  accessLevels?: string[]
}

const int = (v: number | null) => (v == null ? undefined : Math.round(v))

export function BlockEditor({ block, index, count, byId, nameOf, onChange, onMove, onRemove, onPick, accessLevels }: Props) {
  const set = (patch: Partial<BlockDraft>) => onChange({ ...block, ...patch })
  const setParams = (patch: Partial<FormatParams>) => set({ params: { ...block.params, ...patch } })

  function setKind(kind: BlockKind) {
    // Switching kind on an untouched block also switches to that kind's usual format.
    if (block.items.length === 0) {
      const format = DEFAULT_FORMAT[kind]
      set({ kind, format, params: { ...defaultParams(format), ...blockSettings(block.params) } })
    } else set({ kind })
  }
  const setFormat = (format: Format) => set({ format, params: { ...defaultParams(format), ...blockSettings(block.params) } })
  const p = block.params
  // Stored only when it differs from the format's default.
  const setScore = (score: ScoreType) => setParams({ score: score === defaultScoreType(block.format) ? undefined : score })
  const setGroup = (g: number, patch: Partial<BlockDraft['groups'][number]>) =>
    set({ groups: block.groups.map((x, i) => (i === g ? { ...x, ...patch } : x)) })

  const itemEditor = (item: BlockDraft['items'][number], i: number) => (
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
  )

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

        <div>
          <span className="mb-0.5 block text-xs text-zinc-500">Score</span>
          <Chips options={SCORE_TYPES} value={scoreType(block.format, p)} onChange={setScore} />
        </div>

        <div>
          <span className="mb-0.5 block text-xs text-zinc-500">Accès</span>
          <Chips
            options={{ '0': 'Tous', '1': `🔒 ${levelName(accessLevels, 1)}` }}
            value={String(p.min_level ?? 0) as '0' | '1'}
            onChange={(v) => setParams({ min_level: v === '0' ? undefined : Number(v) })}
          />
        </div>
        {scoreType(block.format, p) !== 'none' && (
          <label className={`flex items-center gap-2 text-sm ${p.min_level ? 'text-zinc-500' : 'text-zinc-300'}`}>
            <input
              type="checkbox"
              className="size-4 accent-lime-400"
              // Premium blocks are never ranked.
              disabled={!!p.min_level}
              checked={!p.min_level && p.ranked !== false}
              onChange={(e) => setParams({ ranked: e.target.checked ? undefined : false })}
            />
            <span>
              Compte pour le classement de la semaine
              {!!p.min_level && <span className="block text-xs">Jamais pour un bloc {levelName(accessLevels, 1)}</span>}
            </span>
          </label>
        )}

        {itemRuns(block).map((run) =>
          run.group === null ? (
            run.items.map(({ item, index }) => itemEditor(item, index))
          ) : (
            <div key={`g${run.group}`} className="flex flex-col gap-2 rounded-xl border border-lime-400/40 p-2">
              <div className="flex items-center gap-2">
                <SmallInput
                  placeholder="Sous-bloc (ex. DB DT)"
                  value={block.groups[run.group].title}
                  onChange={(e) => setGroup(run.group!, { title: e.target.value })}
                />
                <button
                  type="button"
                  aria-label="Retirer le sous-bloc"
                  title="Retirer le sous-bloc (garde les mouvements)"
                  className="p-2 text-zinc-500"
                  onClick={() => set(removeGroup(block, run.group!))}
                >
                  ✕
                </button>
              </div>
              {run.items.map(({ item, index }) => itemEditor(item, index))}
              <button
                type="button"
                className="rounded-xl border border-dashed border-zinc-700 py-2 text-sm text-zinc-300"
                onClick={() => onPick(null, undefined, run.group)}
              >
                + Mouvement dans le sous-bloc
              </button>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Rounds au 1er tour">
                  <NumberInput
                    placeholder="1"
                    value={block.groups[run.group].start}
                    onChange={(v) => setGroup(run.group!, { start: int(v) })}
                  />
                </Field>
                <Field label="Rounds ajoutés par tour">
                  <NumberInput
                    placeholder="0"
                    value={block.groups[run.group].step}
                    onChange={(v) => setGroup(run.group!, { step: int(v) })}
                  />
                </Field>
              </div>
              <Field label="Ce qui change à chaque tour">
                <textarea
                  rows={2}
                  placeholder="Tour 1 : 1 round, tour 2 : 2 rounds…"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 outline-none focus:border-lime-400"
                  value={block.groups[run.group].note}
                  onChange={(e) => setGroup(run.group!, { note: e.target.value })}
                />
              </Field>
            </div>
          ),
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-xl border border-dashed border-zinc-700 py-2 text-sm text-zinc-300"
            onClick={() => onPick(null)}
          >
            + Mouvement
          </button>
          <button
            type="button"
            className="rounded-xl border border-dashed border-zinc-700 py-2 text-sm text-zinc-300"
            onClick={() => set({ groups: [...block.groups, { title: '', note: '' }] })}
          >
            + Sous-bloc
          </button>
        </div>

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
