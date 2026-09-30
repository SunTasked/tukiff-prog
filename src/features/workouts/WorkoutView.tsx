import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { loadFromPct } from '../../domain/records'
import { SCORE_HINTS, SCORE_TYPES, scoreType } from '../../domain/scoring'
import { timerFromBlock, timerToParams } from '../../domain/timer'
import { getItem, setItem } from '../../lib/storage'
import { Chips } from '../../components/ui'
import { Markdown } from '../../components/Markdown'
import {
  blockName,
  LEVELS,
  blockLevels,
  isPremium,
  levelName,
  formatSummary,
  itemRuns,
  itemSummary,
  resolveItem,
  type BlockDraft,
  type ItemDraft,
  type Level,
  type LockedBlock,
  type WorkoutDraft,
} from '../../domain/workout'

/** Read-only rendering of a workout, with a level selector (Elite / RX / Scaled / Foundation). */
export function WorkoutView({
  workout,
  nameOf,
  videoOf,
  blockHeader,
  blockFooter,
  oneRmOf,
}: {
  workout: WorkoutDraft
  nameOf: (id: string) => string | undefined
  videoOf?: (id: string) => string | null | undefined
  /** Extra content right after each block's title (reactions). */
  blockHeader?: (block: BlockDraft) => ReactNode
  /** Extra content under each block (results). */
  blockFooter?: (block: BlockDraft, label: string) => ReactNode
  /** Viewer's 1RM per exercise: shows the load for "% 1RM" prescriptions. */
  oneRmOf?: (exerciseId: string) => number | undefined
}) {
  // Level chosen per block; defaults to the athlete's usual level (remembered on the device) when offered.
  const [chosen, setChosen] = useState<Record<string, Level>>({})
  const preferred = getItem('level') as Level | null
  const levelOf = (b: BlockDraft) => {
    const offered = blockLevels(b)
    const l = chosen[b.id] ?? preferred
    return l && offered.includes(l) ? l : 'rx'
  }
  const choose = (blockId: string, l: Level) => {
    setItem('level', l)
    setChosen({ ...chosen, [blockId]: l })
  }

  // Visible and locked blocks in the coach's order, lettered together.
  const entries = workout.blocks.flatMap((block, i) => [
    ...(workout.locked ?? []).filter((l) => l.before === i).map((locked) => ({ locked, block: undefined })),
    { block, locked: undefined },
  ])
  entries.push(
    ...(workout.locked ?? []).filter((l) => l.before >= workout.blocks.length).map((locked) => ({ locked, block: undefined })),
  )
  const lettered = entries.map((e, letter) => ({ ...e, letter }))

  return (
    <div className="flex flex-col gap-4">
      {workout.notes && <p className="whitespace-pre-line text-zinc-300">{workout.notes}</p>}
      {lettered.map(({ block: b, locked, letter: i }) =>
        locked ? (
          <LockedBlockCard key={locked.id} block={locked} letter={String.fromCharCode(65 + i)} />
        ) : (
          <section key={b.id} id={`block-${b.id}`} className="scroll-mt-4 rounded-2xl bg-zinc-900 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                Bloc {String.fromCharCode(65 + i)}
                {isPremium(b) && <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 tracking-normal whitespace-nowrap text-amber-300 normal-case">{levelName(workout.access_levels, b.params.min_level!)}</span>}
              </p>
              <TimerLink block={b} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {(b.title || formatSummary(b.format, b.params)) && (
                <h3 className="min-w-0 text-lg font-bold">
                  {[b.title, formatSummary(b.format, b.params)].filter(Boolean).join(' — ')}
                </h3>
              )}
              {blockHeader?.(b)}
            </div>
            {blockLevels(b).length > 1 && (
              <div className="mt-2">
                <Chips
                  options={Object.fromEntries(blockLevels(b).map((l) => [l, LEVELS[l]])) as Record<Level, string>}
                  value={levelOf(b)}
                  onChange={(l) => choose(b.id, l)}
                />
              </div>
            )}
            {b.format === 'none' && b.notes && <Markdown text={b.notes} className="mt-2 text-sm text-zinc-300" />}
            <ul className="mt-2 flex flex-col gap-1">
              {itemRuns(b).map(({ group, items }, k) => {
                const lines = items.map(({ item, index }) => (
                  <ItemLine
                    key={index}
                    item={resolveItem(item, levelOf(b))}
                    nameOf={nameOf}
                    videoOf={videoOf}
                    oneRmOf={oneRmOf}
                  />
                ))
                if (group === null) return lines
                const g = b.groups[group]
                return (
                  <li key={`g${k}`} className="my-1 rounded-xl border border-zinc-700 p-2">
                    {g.title && <p className="text-sm font-semibold text-lime-400">{g.title}</p>}
                    <ul className="flex flex-col gap-1">{lines}</ul>
                    {g.note && <p className="mt-1 text-sm whitespace-pre-line text-zinc-400">↻ {g.note}</p>}
                  </li>
                )
              })}
            </ul>
            {b.format !== 'none' && b.notes && <p className="mt-2 text-sm whitespace-pre-line text-zinc-400">{b.notes}</p>}
            <ScoreLine block={b} />
            {blockFooter?.(b, `${String.fromCharCode(65 + i)} · ${blockName(b)}`)}
          </section>
        ),
      )}
    </div>
  )
}

/** Block above my access level: title only, closed; tap tells who to ask. */
function LockedBlockCard({ block, letter }: { block: LockedBlock; letter: string }) {
  const [open, setOpen] = useState(false)
  // Deliberately discreet (greyed out like a disabled row): a hint, not an ad.
  return (
    <section className="rounded-2xl bg-zinc-900/40 opacity-50">
      <button className="flex w-full items-center gap-2 px-4 py-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-500">
          {letter} · {block.title || 'Bloc réservé'}
        </span>
        <span className="shrink-0 text-xs grayscale" aria-label="Verrouillé">
          🔒
        </span>
      </button>
      {open && <p className="px-4 pb-3 text-xs text-zinc-500">Contacte les coachs de la box pour en savoir plus.</p>}
    </section>
  )
}

function ItemLine({
  item: r,
  nameOf,
  videoOf,
  oneRmOf,
}: {
  item: ItemDraft
  nameOf: (id: string) => string | undefined
  videoOf?: (id: string) => string | null | undefined
  oneRmOf?: (exerciseId: string) => number | undefined
}) {
  const video = r.exercise_id && videoOf?.(r.exercise_id)
  return (
    <li>
      {itemSummary(r, nameOf)}
      {oneRmOf && r.pct_1rm != null && r.exercise_id && (
        <PctLoad exerciseId={r.exercise_id} pct={r.pct_1rm} oneRm={oneRmOf(r.exercise_id)} />
      )}
      {video && (
        <a href={video} target="_blank" rel="noreferrer" className="ml-2 text-sm text-lime-400">
          ▶ vidéo
        </a>
      )}
      {r.notes && <span className="block text-sm text-zinc-400">{r.notes}</span>}
    </li>
  )
}

/** What the athlete will enter as a score, so there is no guessing what a "round" is. */
function ScoreLine({ block }: { block: BlockDraft }) {
  const type = scoreType(block.format, block.params)
  if (type === 'none') return null
  return (
    <p className="mt-2 text-sm text-zinc-400">
      <span className="font-semibold text-zinc-300">Score : {SCORE_TYPES[type]}</span> · {SCORE_HINTS[type]}
    </p>
  )
}

function PctLoad({ exerciseId, pct, oneRm }: { exerciseId: string; pct: number; oneRm: number | undefined }) {
  if (oneRm === undefined)
    return (
      <Link to={`/records?add=${exerciseId}`} className="ml-2 text-sm text-lime-400">
        1RM ?
      </Link>
    )
  return <span className="ml-2 font-semibold text-lime-400">≈ {loadFromPct(oneRm, pct)} kg</span>
}

function TimerLink({ block }: { block: BlockDraft }) {
  const config = timerFromBlock(block.format, block.params)
  if (!config) return null
  const params = new URLSearchParams({ ...timerToParams(config), title: blockName(block) })
  return (
    <Link to={`/timer?${params}`} className="shrink-0 rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-200">
      ▶ Timer
    </Link>
  )
}
