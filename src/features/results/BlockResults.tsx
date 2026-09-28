import { useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { formatScore, leaderboards, scoreType } from '../../domain/scoring'
import { LEVELS, blockLevels, type BlockDraft, type Level } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
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
  onChange: () => void
}

const MEDALS = ['🥇', '🥈', '🥉']
const BOARD_TITLES = { male: 'Hommes', female: 'Femmes' }

/** "My score" / "Je passe" buttons + one leaderboard per gender, levels stacked (elite, RX, ...) and ranked separately. */
export function BlockResults({ workoutId, block, blockLabel, results, me, canLog, skipped, showBoard, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const type = scoreType(block.format, block.params)
  const mine = results.find((r) => r.athlete_id === me)
  const boards = leaderboards(
    type,
    results.map((r) => ({ ...r, gender: r.profiles?.gender ?? null })),
  )
  const enterLabel = type === 'none' ? 'Marquer comme fait' : 'Saisir mon score'

  async function skip() {
    setBusy(true)
    await supabase.from('block_skips').insert({ workout_id: workoutId, block_id: block.id })
    setBusy(false)
    onChange()
  }

  return (
    <div className="mt-3 border-t border-zinc-800 pt-3">
      {canLog &&
        (mine ? (
          <button className="w-full rounded-xl bg-zinc-800 py-2 text-sm font-semibold text-zinc-100" onClick={() => setOpen(true)}>
            Mon score : {formatScore(type, mine)} · {LEVELS[mine.level as Level]} ✎
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

      {showBoard && boards.map(({ gender, rows }) => (
        <div key={gender} className="mt-3">
          <p className="mb-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase">{BOARD_TITLES[gender]}</p>
          <ol className="flex flex-col gap-1">
            {rows.map(({ result: r, rank, level }) => (
              <li
                key={r.id}
                className={`rounded-lg px-2 py-1.5 text-sm ${r.athlete_id === me ? 'bg-lime-400/10 ring-1 ring-lime-400/40' : 'bg-zinc-950'}`}
              >
                <div className="flex items-center gap-2">
                  {type !== 'none' && (
                    <span className="w-6 shrink-0 text-center text-zinc-500">{rank <= 3 ? MEDALS[rank - 1] : rank}</span>
                  )}
                  <Avatar url={r.profiles?.avatar_url} name={r.profiles?.display_name} className="size-6 text-[10px]" />
                  <span className="min-w-0 flex-1 truncate">{r.profiles?.display_name ?? '—'}</span>
                  <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 uppercase">
                    {LEVELS[level]}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatScore(type, r)}</span>
                </div>
                {r.comment && <p className={`mt-0.5 text-xs whitespace-pre-line text-zinc-400 ${type === 'none' ? 'pl-8' : 'pl-16'}`}>{r.comment}</p>}
              </li>
            ))}
          </ol>
        </div>
      ))}

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
