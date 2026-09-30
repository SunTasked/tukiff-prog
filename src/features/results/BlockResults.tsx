import { useState } from 'react'
import { Avatar } from '../../components/Avatar'
import type { Gender } from '../../domain/profile'
import { formatBreakdown, repBreakdown } from '../../domain/repcount'
import { compactRows, formatScore, leaderboards, myGenderFirst, scoreType, type ScoreType } from '../../domain/scoring'
import { LEVELS, blockLevels, type BlockDraft, type Level } from '../../domain/workout'
import { getItem } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { GenderTabs } from './GenderTabs'
import { LeaderBadge } from './LeaderBadge'
import { ScoreSheet } from './ScoreSheet'
import type { ResultRow } from './useWorkoutResults'

type Props = {
  workoutId: string
  block: BlockDraft
  blockLabel: string
  results: ResultRow[]
  me: string | undefined
  canLog: boolean
  /** I marked this block "Je passe"; entering a score clears it. */
  skipped: boolean
  /** Other athletes' scores (off when the program's leaderboard is disabled, for athletes). */
  showBoard: boolean
  /** Leaders of the program's weekly leaderboard (LEADER badge). */
  leaders: Set<string>
  onChange: () => void
}

const MEDALS = ['🥇', '🥈', '🥉']
const BOARD_TITLES = { male: 'Hommes', female: 'Femmes' }

/**
 * "My score" / "Je passe" buttons + one leaderboard per gender, levels stacked (elite, RX, ...) and ranked separately.
 * Compact: only my category (gender + level), its top 3 plus me; the full board opens in a sheet.
 */
export function BlockResults({ workoutId, block, blockLabel, results, me, canLog, skipped, showBoard, leaders, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [full, setFull] = useState(false)
  const type = scoreType(block.format, block.params)
  const mine = results.find((r) => r.athlete_id === me)
  const { profile } = useAuth()
  const boards = myGenderFirst(
    leaderboards(
      type,
      results.map((r) => ({ ...r, gender: r.profiles?.gender ?? null })),
    ),
    profile?.gender,
  )
  // AMRAP scored in total reps: the total explained in rounds, ladder rounds and reps.
  const detail = (r: ResultRow) => {
    const b = type === 'reps' && block.format === 'amrap' && r.reps ? repBreakdown(block, r.reps) : null
    return b && formatBreakdown(b)
  }
  // Full leaderboard: one tab per gender, the viewer's own open first.
  const [tab, setTab] = useState<Gender>(profile?.gender === 'female' ? 'female' : 'male')
  const boardOf = (g: Gender) => boards.find((b) => b.gender === g)?.rows ?? []
  const genderCounts = { male: boardOf('male').length, female: boardOf('female').length }
  // My category: my gender, and the level of my score (else my usual level for this block).
  const myGender: Gender = profile?.gender === 'female' ? 'female' : 'male'
  const preferred = getItem('level') as Level | null
  const myLevel: Level = (mine?.level as Level | undefined) ?? (preferred && blockLevels(block).includes(preferred) ? preferred : 'rx')
  const myRows = boardOf(myGender).filter((row) => row.level === myLevel)
  const enterLabel = type === 'none' ? 'Marquer comme fait' : 'Saisir mon score'
  const checkable = type === 'none'
  // Blocks without score have no leaderboard, only the athletes' comments.
  const commented = results.filter((r) => r.comment?.trim())

  // Blocks without score: one tap on the "Fait" box, the sheet stays available for level and comment.
  async function toggleDone() {
    setBusy(true)
    if (mine) await supabase.from('results').delete().eq('id', mine.id)
    else {
      const levels = blockLevels(block)
      const preferred = getItem('level') as Level | null
      const level = preferred && levels.includes(preferred) ? preferred : 'rx'
      const { error } = await supabase.from('results').insert({ workout_id: workoutId, block_id: block.id, level })
      if (!error && skipped) await supabase.from('block_skips').delete().eq('block_id', block.id).eq('athlete_id', me!)
    }
    setBusy(false)
    onChange()
  }

  async function skip() {
    setBusy(true)
    await supabase.from('block_skips').insert({ workout_id: workoutId, block_id: block.id })
    setBusy(false)
    onChange()
  }

  return (
    <div className="mt-3 border-t border-zinc-800 pt-3">
      {canLog && checkable && (
        <div className="flex gap-2">
          <button
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold ${
              mine ? 'bg-lime-400 text-zinc-950' : 'border border-zinc-700 text-zinc-200'
            }`}
            disabled={busy}
            aria-pressed={!!mine}
            onClick={toggleDone}
          >
            <span
              className={`flex size-5 items-center justify-center rounded-md border-2 text-xs ${
                mine ? 'border-zinc-950 bg-zinc-950 text-lime-400' : 'border-zinc-500'
              }`}
            >
              {mine ? '✓' : ''}
            </span>
            Fait
          </button>
          {mine ? (
            <button className="shrink-0 rounded-xl bg-zinc-800 px-3 py-2 text-sm text-zinc-300" onClick={() => setOpen(true)}>
              Commenter ✎
            </button>
          ) : skipped ? (
            <span className="shrink-0 rounded-xl bg-zinc-800 px-3 py-2 text-sm text-zinc-400">⏭ Passé</span>
          ) : (
            <button
              className="shrink-0 rounded-xl bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-300"
              disabled={busy}
              onClick={skip}
            >
              Je passe
            </button>
          )}
        </div>
      )}
      {canLog &&
        !checkable &&
        (mine ? (
          <button className="w-full rounded-xl bg-zinc-800 py-2 text-sm font-semibold text-zinc-100" onClick={() => setOpen(true)}>
            Mon score : {formatScore(type, mine)} · {LEVELS[mine.level as Level]} ✎
            {detail(mine) && <span className="block text-xs font-normal text-zinc-400">{detail(mine)}</span>}
          </button>
        ) : skipped ? (
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-xl bg-zinc-800 px-3 py-2 text-sm text-zinc-400">⏭ Passé</span>
            <button className="flex-1 rounded-xl border border-zinc-700 py-2 text-sm font-semibold text-zinc-200" onClick={() => setOpen(true)}>
              {enterLabel}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="flex-1 rounded-xl bg-lime-400 py-2 text-sm font-semibold text-zinc-950" onClick={() => setOpen(true)}>
              {enterLabel}
            </button>
            <button
              className="shrink-0 rounded-xl bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-300"
              disabled={busy}
              onClick={skip}
            >
              Je passe
            </button>
          </div>
        ))}

      {showBoard && checkable && commented.length > 0 && (
        <button className="mt-3 w-full text-center text-sm text-lime-400" onClick={() => setFull(true)}>
          Voir les commentaires ({commented.length}) ›
        </button>
      )}

      {showBoard && !checkable && boards.length > 0 && (
        <>
          <Board
            gender={myGender}
            title={`${BOARD_TITLES[myGender]} · ${LEVELS[myLevel]}`}
            rows={compactRows(myRows, me)}
            type={type}
            me={me}
            leaders={leaders}
            detail={detail}
          />
          <button className="mt-2 w-full text-center text-sm text-lime-400" onClick={() => setFull(true)}>
            Voir le classement complet ({results.length}) ›
          </button>
        </>
      )}

      {full && checkable && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 pt-[env(safe-area-inset-top)] lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black">
          <div className="flex items-center justify-between border-b border-zinc-800 p-3">
            <span className="min-w-0 truncate font-semibold">Commentaires · {blockLabel}</span>
            <button className="px-2 text-zinc-400" onClick={() => setFull(false)}>
              Fermer
            </button>
          </div>
          <ol className="flex flex-1 flex-col gap-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {commented.map((r) => (
              <li key={r.id} className={`rounded-lg px-2 py-1.5 text-sm ${r.athlete_id === me ? 'bg-lime-400/10 ring-1 ring-lime-400/40' : 'bg-zinc-900'}`}>
                <div className="flex items-center gap-2">
                  <Avatar url={r.profiles?.avatar_url} name={r.profiles?.display_name} className="size-6 text-[10px]" />
                  <span className="min-w-0 truncate">{r.profiles?.display_name ?? '—'}</span>
                </div>
                <p className="mt-0.5 pl-8 text-xs whitespace-pre-line text-zinc-400">{r.comment}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {full && !checkable && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 pt-[env(safe-area-inset-top)] lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black">
          <div className="flex items-center justify-between border-b border-zinc-800 p-3">
            <span className="min-w-0 truncate font-semibold">Classement · {blockLabel}</span>
            <button className="px-2 text-zinc-400" onClick={() => setFull(false)}>
              Fermer
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <GenderTabs value={tab} counts={genderCounts} onChange={setTab} />
            <Board gender={tab} showTitle={false} rows={boardOf(tab)} type={type} me={me} leaders={leaders} detail={detail} />
          </div>
        </div>
      )}

      {open && (
        <ScoreSheet
          timeCap={block.params.time_cap_s}
          workoutId={workoutId}
          blockId={block.id}
          blockLabel={blockLabel}
          type={type}
          block={block}
          levels={blockLevels(block)}
          existing={mine}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false)
            if (skipped) await supabase.from('block_skips').delete().eq('block_id', block.id).eq('athlete_id', me!)
            onChange()
          }}
        />
      )}
    </div>
  )
}

type BoardRow = { result: ResultRow; rank: number; level: Level }

function Board({
  gender,
  title,
  showTitle = true,
  rows,
  type,
  me,
  leaders,
  detail,
}: {
  gender: Gender
  title?: string
  showTitle?: boolean
  rows: BoardRow[]
  type: ScoreType
  me: string | undefined
  leaders: Set<string>
  detail: (r: ResultRow) => string | null
}) {
  return (
    <div className="mt-3">
      {showTitle && <p className="mb-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase">{title ?? BOARD_TITLES[gender]}</p>}
      {rows.length === 0 && <p className="text-sm text-zinc-500">Pas encore de score.</p>}
      <ol className="flex flex-col gap-1">
        {rows.map(({ result: r, rank, level }) => (
          <li
            key={r.id}
            className={`rounded-lg px-2 py-1.5 text-sm ${r.athlete_id === me ? 'bg-lime-400/10 ring-1 ring-lime-400/40' : 'bg-zinc-950'}`}
          >
            <div className="flex items-center gap-2">
              {type !== 'none' && <span className="w-6 shrink-0 text-center text-zinc-500">{rank <= 3 ? MEDALS[rank - 1] : rank}</span>}
              <Avatar url={r.profiles?.avatar_url} name={r.profiles?.display_name} className="size-6 text-[10px]" />
              <span className="min-w-0 truncate">{r.profiles?.display_name ?? '—'}</span>
              {leaders.has(r.athlete_id) && <LeaderBadge />}
              <span className="flex-1" />
              <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 uppercase">
                {LEVELS[level]}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatScore(type, r)}</span>
            </div>
            {detail(r) && <p className="text-right text-[11px] text-zinc-500">{detail(r)}</p>}
            {r.comment && <p className={`mt-0.5 text-xs whitespace-pre-line text-zinc-400 ${type === 'none' ? 'pl-8' : 'pl-16'}`}>{r.comment}</p>}
          </li>
        ))}
      </ol>
    </div>
  )
}
