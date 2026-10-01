import { useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { scoreName, type Gender } from '../../domain/profile'
import { AthleteName } from './AthleteName'
import { formatBreakdown, repBreakdown } from '../../domain/repcount'
import {
  TEAM_CATEGORIES,
  compactRows,
  formatScore,
  isRanked,
  leaderboards,
  myGenderFirst,
  scoreType,
  teamBoards,
  teamCategory,
  type BoardRow,
  type ScoreType,
  type Team,
  type TeamCategory,
} from '../../domain/scoring'
import type { BlockDraft } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { GenderTabs } from './GenderTabs'
import { LeaderBadge } from './LeaderBadge'
import { PeopleSheet } from './PeopleSheet'
import { ScoreSheet } from './ScoreSheet'
import type { Claps } from './useClaps'
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
  /** Claps of the workout (absent when the program's reactions are off). */
  claps?: Claps
  onClap: (resultId: string) => void
  onUnclap: (resultId: string) => void
  onChange: () => void
}

const MEDALS = ['🥇', '🥈', '🥉']
const BOARD_TITLES = { male: 'Hommes', female: 'Femmes' }

/**
 * "My score" / "Je passe" buttons + one leaderboard per gender: the RX ranked, the scaled scores under them, unranked.
 * Compact: my gender only, its RX top 3 plus me; the full board opens in a sheet.
 */
export function BlockResults({ workoutId, block, blockLabel, results, me, canLog, skipped, showBoard, leaders, claps, onClap, onUnclap, onChange }: Props) {
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
  const myGender: Gender = profile?.gender === 'female' ? 'female' : 'male'
  const enterLabel = type === 'none' ? 'Marquer comme fait' : block.params.team_size ? 'Saisir le score d’équipe' : 'Saisir mon score'
  const checkable = type === 'none'
  const [clappers, setClappers] = useState<string | null>(null)
  const clapping: Clapping | undefined = claps && { claps, me, canClap: canLog, onClap, onUnclap, onShow: setClappers }
  // Blocks without score have no leaderboard, only the athletes' comments.
  const commented = results.filter((r) => r.comment?.trim())
  // Unranked blocks (coach's choice, premium): my score only, the others' in a plain list by name.
  const ranked = isRanked(block.format, block.params)
  const byName = [...results].sort((a, b) => scoreName(a.profiles).localeCompare(scoreName(b.profiles), 'fr'))
  // Team WOD: one score per team, boards men / women / mixed teams.
  const teamSize = type !== 'none' ? block.params.team_size : undefined
  const withGender = results.map((r) => ({ ...r, gender: r.profiles?.gender ?? null }))
  const teams = teamSize ? teamBoards(type, withGender) : []
  const teamRows = mine?.team_id ? results.filter((r) => r.team_id === mine.team_id && r.athlete_id !== me) : []
  const teamCount = teams.reduce((n, b) => n + b.rows.length, 0)
  const teamOf = (c: TeamCategory) => teams.find((b) => b.category === c)?.rows ?? []
  const myTeam = teams.flatMap((b) => b.rows).find((row) => row.result.members.some((m) => m.athlete_id === me))
  const myCategory: TeamCategory = myTeam?.result.category ?? teamCategory([(profile?.gender as Gender | null) ?? null])
  const [teamTab, setTeamTab] = useState<TeamCategory>(myCategory)

  // Blocks without score: one tap on the "Fait" box, the sheet stays available for the comment.
  async function toggleDone() {
    setBusy(true)
    if (mine) await supabase.from('results').delete().eq('id', mine.id)
    else {
      const { error } = await supabase.from('results').insert({ workout_id: workoutId, block_id: block.id })
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
            {teamSize ? 'Équipe' : 'Mon score'} : {formatScore(type, mine)}
            {ranked && mine.rx && ' · RX'} ✎
            {!!teamSize && (teamRows.length > 0 || !!myTeam?.result.guests.length) && (
              <span className="block truncate text-xs font-normal text-zinc-400">
                avec {[...teamRows.map((r) => scoreName(r.profiles)), ...(myTeam?.result.guests ?? []).map((g) => g.name)].join(', ')}
              </span>
            )}
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

      {showBoard && !checkable && !ranked && !teamSize && results.length > 0 && (
        <button className="mt-3 w-full text-center text-sm text-lime-400" onClick={() => setFull(true)}>
          Voir les scores ({results.length}) ›
        </button>
      )}

      {showBoard && teamSize && teamCount > 0 && (
        <>
          {ranked && (
            <TeamBoard title={TEAM_CATEGORIES[myCategory]} rows={compactRows(teamOf(myCategory), me)} type={type} me={me} clapping={clapping} />
          )}
          <button className="mt-2 w-full text-center text-sm text-lime-400" onClick={() => setFull(true)}>
            {ranked ? `Voir le classement complet (${teamCount}) ›` : `Voir les scores (${teamCount}) ›`}
          </button>
        </>
      )}

      {showBoard && !checkable && ranked && !teamSize && boards.length > 0 && (
        <>
          <Board
            gender={myGender}
            rows={compactRows(boardOf(myGender), me)}
            type={type}
            me={me}
            leaders={leaders}
            clapping={clapping}
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
                  <Avatar url={r.profiles?.avatar_url} name={scoreName(r.profiles)} className="size-6 text-[10px]" />
                  <AthleteName profile={r.profiles} />
                </div>
                <p className="mt-0.5 pl-8 text-xs whitespace-pre-line text-zinc-400">{r.comment}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {full && teamSize && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 pt-[env(safe-area-inset-top)] lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black">
          <div className="flex items-center justify-between border-b border-zinc-800 p-3">
            <span className="min-w-0 truncate font-semibold">{ranked ? 'Classement' : 'Scores'} · {blockLabel}</span>
            <button className="px-2 text-zinc-400" onClick={() => setFull(false)}>
              Fermer
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mb-3 flex gap-1 rounded-xl bg-zinc-900 p-1">
              {(Object.keys(TEAM_CATEGORIES) as TeamCategory[]).map((c) => (
                <button
                  key={c}
                  className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${c === teamTab ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400'}`}
                  onClick={() => setTeamTab(c)}
                >
                  {TEAM_CATEGORIES[c]} ({teamOf(c).length})
                </button>
              ))}
            </div>
            <TeamBoard
              rows={ranked ? teamOf(teamTab) : teamOf(teamTab).map((row) => ({ ...row, rank: null }))}
              type={type}
              me={me}
              clapping={clapping}
              unranked={!ranked}
            />
          </div>
        </div>
      )}

      {full && !checkable && !ranked && !teamSize && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 pt-[env(safe-area-inset-top)] lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black">
          <div className="flex items-center justify-between border-b border-zinc-800 p-3">
            <span className="min-w-0 truncate font-semibold">Scores · {blockLabel}</span>
            <button className="px-2 text-zinc-400" onClick={() => setFull(false)}>
              Fermer
            </button>
          </div>
          <ol className="flex flex-1 flex-col gap-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {byName.map((r) => (
              <li key={r.id} className={`rounded-lg px-2 py-1.5 text-sm ${r.athlete_id === me ? 'bg-lime-400/10 ring-1 ring-lime-400/40' : 'bg-zinc-900'}`}>
                <div className="flex items-center gap-2">
                  <Avatar url={r.profiles?.avatar_url} name={scoreName(r.profiles)} className="size-6 text-[10px]" />
                  <AthleteName profile={r.profiles} />
                  <span className="flex-1" />
                  <span className="shrink-0 font-semibold tabular-nums">{formatScore(type, r)}</span>
                </div>
                {detail(r) && <p className="text-right text-[11px] text-zinc-500">{detail(r)}</p>}
                {r.comment && <p className="mt-0.5 pl-8 text-xs whitespace-pre-line text-zinc-400">{r.comment}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {full && !checkable && ranked && !teamSize && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 pt-[env(safe-area-inset-top)] lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black">
          <div className="flex items-center justify-between border-b border-zinc-800 p-3">
            <span className="min-w-0 truncate font-semibold">Classement · {blockLabel}</span>
            <button className="px-2 text-zinc-400" onClick={() => setFull(false)}>
              Fermer
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <GenderTabs value={tab} counts={genderCounts} onChange={setTab} />
            <Board gender={tab} showTitle={false} rows={boardOf(tab)} type={type} me={me} leaders={leaders} clapping={clapping} detail={detail} />
          </div>
        </div>
      )}

      {clapping && clappers && (
        <PeopleSheet
          title={`👏 Claps (${clapping.claps.received.get(clappers)?.length ?? 0})`}
          people={clapping.claps.received.get(clappers) ?? []}
          onClose={() => setClappers(null)}
        />
      )}

      {open && (
        <ScoreSheet
          timeCap={block.params.time_cap_s}
          workoutId={workoutId}
          blockId={block.id}
          blockLabel={blockLabel}
          type={type}
          block={block}
          ranked={ranked}
          existing={mine}
          team={teamSize ? { size: teamSize, rows: teamRows } : undefined}
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

const RxTag = () => (
  <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 uppercase">RX</span>
)

function Board({
  gender,
  title,
  showTitle = true,
  rows,
  type,
  me,
  leaders,
  clapping,
  detail,
}: {
  gender: Gender
  title?: string
  showTitle?: boolean
  rows: BoardRow<ResultRow>[]
  type: ScoreType
  me: string | undefined
  leaders: Set<string>
  clapping?: Clapping
  detail: (r: ResultRow) => string | null
}) {
  return (
    <div className="mt-3">
      {showTitle && <p className="mb-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase">{title ?? BOARD_TITLES[gender]}</p>}
      {rows.length === 0 && <p className="text-sm text-zinc-500">Pas encore de score.</p>}
      <ol className="flex flex-col gap-1">
        {rows.map(({ result: r, rank }) => (
          <li
            key={r.id}
            className={`rounded-lg px-2 py-1.5 text-sm ${r.athlete_id === me ? 'bg-lime-400/10 ring-1 ring-lime-400/40' : 'bg-zinc-950'}`}
          >
            <div className="flex items-center gap-2">
              {type !== 'none' && (
                <span className="w-6 shrink-0 text-center text-zinc-500">{rank === null ? '–' : rank <= 3 ? MEDALS[rank - 1] : rank}</span>
              )}
              <Avatar url={r.profiles?.avatar_url} name={scoreName(r.profiles)} className="size-6 text-[10px]" />
              <AthleteName profile={r.profiles} />
              {leaders.has(r.athlete_id) && <LeaderBadge />}
              <span className="flex-1" />
              {clapping && <ClapButton resultId={r.id} mine={r.athlete_id === me} clapping={clapping} />}
              {rank !== null && <RxTag />}
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

type TeamResult = Team<ResultRow & { gender: Gender | null }>

/** Team leaderboard: one row per team, its members' names (guests in grey), the team's score. */
function TeamBoard({
  title,
  rows,
  type,
  me,
  clapping,
  unranked = false,
}: {
  title?: string
  rows: BoardRow<TeamResult>[]
  type: ScoreType
  me: string | undefined
  clapping?: Clapping
  unranked?: boolean
}) {
  return (
    <div className="mt-3">
      {title && <p className="mb-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase">{title}</p>}
      {rows.length === 0 && <p className="text-sm text-zinc-500">Pas encore de score.</p>}
      <ol className="flex flex-col gap-1">
        {rows.map(({ result: t, rank }) => {
          const comment = t.members.find((m) => m.comment)?.comment
          const ours = t.members.some((m) => m.athlete_id === me)
          return (
            <li
              key={t.id}
              className={`rounded-lg px-2 py-1.5 text-sm ${
                ours ? 'bg-lime-400/10 ring-1 ring-lime-400/40' : 'bg-zinc-950'
              }`}
            >
              <div className="flex items-center gap-2">
                {!unranked && (
                  <span className="w-6 shrink-0 text-center text-zinc-500">{rank === null ? '–' : rank <= 3 ? MEDALS[rank - 1] : rank}</span>
                )}
                <span className="flex shrink-0 -space-x-2">
                  {t.members.map((m) => (
                    <Avatar key={m.id} url={m.profiles?.avatar_url} name={scoreName(m.profiles)} className="size-6 text-[10px] ring-2 ring-zinc-950" />
                  ))}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {t.members.map((m) => scoreName(m.profiles)).join(' · ')}
                  {t.guests.length > 0 && <span className="text-zinc-500"> · {t.guests.map((g) => g.name).join(' · ')}</span>}
                </span>
                {/* A clap goes to the whole team, stored on one teammate's row (see clapTarget). */}
                {clapping && <ClapButton resultId={t.clapTarget} mine={ours} clapping={clapping} />}
                {rank !== null && <RxTag />}
                <span className="shrink-0 font-semibold tabular-nums">{formatScore(type, t)}</span>
              </div>
              {comment && <p className="mt-0.5 pl-16 text-xs whitespace-pre-line text-zinc-400">{comment}</p>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

type Clapping = {
  claps: Claps
  me: string | undefined
  /** I can clap others' scores when the workout is assigned to me. */
  canClap: boolean
  onClap: (resultId: string) => void
  onUnclap: (resultId: string) => void
  onShow: (resultId: string) => void
}

/**
 * Others' scores: a grey 👏 to clap (once per score), coloured with the count once clapped; a tap again takes it back.
 * My score: the count, a tap shows who clapped.
 */
function ClapButton({ resultId, mine, clapping }: { resultId: string; mine: boolean; clapping: Clapping }) {
  const count = clapping.claps.counts.get(resultId) ?? 0
  const label = count > 0 ? ` ${count}` : ''
  const pill = 'shrink-0 rounded-full px-1.5 py-0.5 text-xs leading-none tabular-nums'
  if (mine)
    return count > 0 ? (
      <button className={`${pill} bg-zinc-800 text-zinc-200`} aria-label="Voir qui a clappé" onClick={() => clapping.onShow(resultId)}>
        👏{label}
      </button>
    ) : null
  if (clapping.claps.given.has(resultId))
    return (
      <button className={`${pill} font-semibold text-lime-300`} aria-label="Retirer mon clap" onClick={() => clapping.onUnclap(resultId)}>
        👏{label}
      </button>
    )
  if (clapping.canClap)
    return (
      <button className={`${pill} text-zinc-500`} aria-label="Clapper ce score" onClick={() => clapping.onClap(resultId)}>
        <span className="opacity-50 grayscale">👏</span>
        {label}
      </button>
    )
  return count > 0 ? <span className={`${pill} text-zinc-400`}>👏{label}</span> : null
}
