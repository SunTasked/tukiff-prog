import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { loadFromPct } from '../../domain/records'
import { scoreType } from '../../domain/scoring'
import { timerFromBlock, timerToParams } from '../../domain/timer'
import { Markdown } from '../../components/Markdown'
import { SponsorLogo } from '../../components/SponsorLogo'
import { useSponsors } from '../../lib/sponsors'
import { useBenchmarkMovements } from '../records/useRecords'
import {
  blockName,
  isPremium,
  levelName,
  blockHeading,
  itemRuns,
  itemSummary,
  type BlockDraft,
  type ItemDraft,
  type LockedBlock,
  type WorkoutDraft,
} from '../../domain/workout'

/** Read-only rendering of a workout (RX), with the coach's scaling options under each block. */
export function WorkoutView({
  workout,
  nameOf,
  videoOf,
  blockFooter,
  oneRmOf,
}: {
  workout: WorkoutDraft
  nameOf: (id: string) => string | undefined
  videoOf?: (id: string) => string | null | undefined
  /** Extra content under each block (results). */
  blockFooter?: (block: BlockDraft, label: string) => ReactNode
  /** Viewer's 1RM per exercise: shows the load for "% 1RM" prescriptions. */
  oneRmOf?: (exerciseId: string) => number | undefined
}) {
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
              <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                <p className="shrink-0 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                  Bloc {String.fromCharCode(65 + i)}
                  {isPremium(b) && <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 tracking-normal whitespace-nowrap text-amber-300 normal-case">{levelName(workout.access_levels, b.params.min_level!)}</span>}
                </p>
                {b.params.sponsor_id && <SponsorBadge id={b.params.sponsor_id} />}
              </div>
              <TimerLink block={b} />
            </div>
            {blockHeading(b) && <h3 className="mt-1 text-lg font-bold">{blockHeading(b)}</h3>}
            {b.format === 'none' && b.notes && <Markdown text={b.notes} className="mt-2 text-sm text-zinc-300" />}
            <ul className="mt-2 flex flex-col gap-1">
              {itemRuns(b).map(({ group, items }, k) => {
                const lines = items.map(({ item, index }) => (
                  <ItemLine
                    key={index}
                    item={item}
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
            {b.params.scaling?.trim() && (
              <details className="mt-2 rounded-xl bg-zinc-950 px-3 py-2">
                <summary className="cursor-pointer text-sm font-semibold text-zinc-300">Adaptations</summary>
                <Markdown text={b.params.scaling} className="mt-1 text-sm text-zinc-400" />
              </details>
            )}
            <ScoreLine block={b} />
            {blockFooter?.(b, `${String.fromCharCode(65 + i)} · ${blockName(b)}`)}
          </section>
        ),
      )}
    </div>
  )
}

/** "powered by" + logo next to "Bloc A"; opens the sponsor's site when it has one. */
function SponsorBadge({ id }: { id: string }) {
  const sponsor = useSponsors().find((s) => s.id === id)
  if (!sponsor) return null
  const content = (
    <>
      <span className="text-[10px] leading-none whitespace-nowrap text-zinc-500 italic max-[359px]:hidden">powered by</span>
      <SponsorLogo sponsor={sponsor} className="h-5" />
    </>
  )
  return sponsor.link ? (
    <a href={sponsor.link} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2">
      {content}
    </a>
  ) : (
    <div className="flex min-w-0 items-center gap-2">{content}</div>
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

/** Team size and the coach's note on how to enter the score, if any (the score type itself is implied by the block). */
function ScoreLine({ block }: { block: BlockDraft }) {
  const { team_size, score_note } = block.params
  if (scoreType(block.format, block.params) === 'none' || (!team_size && !score_note)) return null
  return (
    <p className="mt-2 text-sm text-zinc-400">
      {team_size && <span className="font-semibold text-zinc-300">Équipe de {team_size}</span>}
      {team_size && score_note && ' · '}
      {score_note}
    </p>
  )
}

function PctLoad({ exerciseId, pct, oneRm }: { exerciseId: string; pct: number; oneRm: number | undefined }) {
  const movements = useBenchmarkMovements()
  // Records are entered on the movement benchmarks only.
  if (oneRm === undefined)
    return movements.has(exerciseId) ? (
      <Link to={`/library/movements/${exerciseId}?add=1`} className="ml-2 text-sm text-lime-400">
        1RM ?
      </Link>
    ) : null
  return <span className="ml-2 font-semibold text-lime-400">≈ {loadFromPct(oneRm, pct)} kg</span>
}

function TimerLink({ block }: { block: BlockDraft }) {
  const config = timerFromBlock(block.format, block.params)
  if (!config) return null
  const params = new URLSearchParams({ ...timerToParams(config), title: blockName(block) })
  return (
    <Link to={`/timer?${params}`} className="shrink-0 rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-200">
      ⏱️ Timer
    </Link>
  )
}
