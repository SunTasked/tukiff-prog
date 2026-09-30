import { useState } from 'react'
import { DurationPicker, NumberInput } from '../../components/inputs'
import { Chips, Field, SmallInput } from '../../components/ui'
import { SCORE_TYPES, defaultScoreType, scoreType, type ScoreType } from '../../domain/scoring'
import {
  BLOCK_KINDS,
  blockSettings,
  levelName,
  FORMATS,
  defaultParams,
  itemRuns,
  removeGroup,
  type AccessLevel,
  type AltLevel,
  type BlockDraft,
  type BlockKind,
  type Format,
  type FormatParams,
  type Measure,
} from '../../domain/workout'
import type { Exercise } from '../../lib/supabase'
import { Markdown } from '../../components/Markdown'
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
  /** The program's access levels above Base. */
  accessLevels?: AccessLevel[]
}

const int = (v: number | null) => (v == null ? undefined : Math.round(v))

export function BlockEditor({ block, index, count, byId, nameOf, onChange, onMove, onRemove, onPick, accessLevels }: Props) {
  const set = (patch: Partial<BlockDraft>) => onChange({ ...block, ...patch })
  const setParams = (patch: Partial<FormatParams>) => set({ params: { ...block.params, ...patch } })

  const [preview, setPreview] = useState(false)
  const setFormat = (format: Format) => set({ format, params: { ...defaultParams(format), ...blockSettings(block.params) } })
  const p = block.params
  // Levels offered: the program's, and at least the block's own (library templates have no program).
  const levelCount = Math.max(accessLevels?.length ?? 0, p.min_level ?? 0)
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
      <div className="mb-2 flex items-center gap-2">
        <span className="shrink-0 text-sm font-bold text-zinc-400">Bloc {String.fromCharCode(65 + index)}</span>
        <select
          aria-label="Catégorie"
          className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 py-2 pr-1 pl-2 text-sm text-lime-400 outline-none focus:border-lime-400"
          value={block.kind}
          onChange={(e) => set({ kind: e.target.value as BlockKind })}
        >
          {(Object.keys(BLOCK_KINDS) as BlockKind[]).map((k) => (
            <option key={k} value={k}>
              {BLOCK_KINDS[k]}
            </option>
          ))}
        </select>
        <input
          aria-label="Titre du bloc"
          placeholder="Titre (option)"
          className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-sm text-zinc-100 outline-none focus:border-lime-400"
          value={block.title}
          onChange={(e) => set({ title: e.target.value })}
        />
        <div className="flex shrink-0 text-zinc-400">
          <button type="button" className="px-1.5 py-1 disabled:opacity-30" disabled={index === 0} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button
            type="button"
            className="px-1.5 py-1 disabled:opacity-30"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button type="button" className="px-1.5 py-1 text-red-400" onClick={onRemove}>
            ✕
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Chips options={FORMATS} value={block.format} onChange={setFormat} />

        {block.format !== 'none' && (
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
          </div>
        )}

        {block.format === 'none' && (
          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs text-zinc-500">
              <span>Texte libre (markdown)</span>
              <button type="button" className="text-lime-400" onClick={() => setPreview(!preview)}>
                {preview ? 'Modifier' : 'Aperçu'}
              </button>
            </div>
            {preview ? (
              <Markdown
                text={block.notes || '_Rien à afficher_'}
                className="min-h-24 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-sm text-zinc-300"
              />
            ) : (
              <textarea
                rows={5}
                placeholder={'# Échauffement\n- 2 rounds :\n- 10 **air squats**\n- 200 m run'}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 font-mono text-sm outline-none focus:border-lime-400"
                value={block.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            )}
          </div>
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

        {block.format !== 'none' && (
          <Field label="Notes du bloc">
            <textarea
              rows={2}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 outline-none focus:border-lime-400"
              value={block.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </Field>
        )}

        <div className="mt-1 flex flex-col gap-2 border-t border-zinc-800 pt-2">
          <div>
            <span className="mb-0.5 block text-xs text-zinc-500">Score</span>
            <Chips options={SCORE_TYPES} value={scoreType(block.format, p)} onChange={setScore} />
          </div>

          {levelCount > 0 && (
            <div>
              <span className="mb-0.5 block text-xs text-zinc-500">Accès</span>
              <Chips
                options={Object.fromEntries(
                  Array.from({ length: levelCount + 1 }, (_, l) => [
                    String(l),
                    l ? `🔒 ${levelName(accessLevels, l)}` : 'Tous',
                  ]),
                )}
                value={String(p.min_level ?? 0)}
                onChange={(v) => setParams({ min_level: v === '0' ? undefined : Number(v) })}
              />
            </div>
          )}
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
                {!!p.min_level && <span className="block text-xs">Jamais pour un bloc réservé</span>}
              </span>
            </label>
          )}
        </div>
      </div>
    </section>
  )
}
