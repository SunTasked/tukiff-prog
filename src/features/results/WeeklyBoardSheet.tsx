import { useEffect, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { Card, Spinner } from '../../components/ui'
import { addDays, formatWeek, mondayOf } from '../../domain/dates'
import type { Gender } from '../../domain/profile'
import { useAuth } from '../auth/AuthProvider'
import { GenderTabs } from './GenderTabs'
import { LeaderBadge } from './LeaderBadge'
import { loadWeeklyBoards, type WeeklyBoards } from './weeklyBoards'

const MEDALS = ['🥇', '🥈', '🥉']

/** Weekly leaderboard of one program (Monday to Sunday) in a modal, from the published workouts of the week. */
export function WeeklyBoardSheet({
  programId,
  programName,
  week,
  onClose,
}: {
  programId: string
  programName: string
  week: string
  onClose: () => void
}) {
  const { session, profile } = useAuth()
  const me = session?.user.id
  const [monday, setMonday] = useState(mondayOf(week))
  const [enabled, setEnabled] = useState(true)
  const [boards, setBoards] = useState<WeeklyBoards | null>(null)
  const [tab, setTab] = useState<Gender>(profile?.gender === 'female' ? 'female' : 'male')
  const countOf = (g: Gender) => boards?.find((b) => b.gender === g)?.rows.length ?? 0

  useEffect(() => {
    let live = true
    setBoards(null)
    loadWeeklyBoards(programId, monday, true).then(({ enabled, boards }) => {
      if (!live) return
      setEnabled(enabled)
      setBoards(boards)
    })
    return () => {
      live = false
    }
  }, [programId, monday])

  const goTo = setMonday

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 pt-[env(safe-area-inset-top)] lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black">
      <div className="flex items-center justify-between border-b border-zinc-800 p-3">
        <span className="min-w-0 truncate font-semibold">Classement de la semaine · {programName}</span>
        <button className="px-2 text-zinc-400" onClick={onClose}>
          Fermer
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center justify-between">
          <button
            className="px-2 py-1 text-xl text-zinc-400"
            aria-label="Semaine précédente"
            onClick={() => goTo(addDays(monday, -7))}
          >
            ‹
          </button>
          <span className="font-semibold">{formatWeek(monday)}</span>
          <button
            className="px-2 py-1 text-xl text-zinc-400"
            aria-label="Semaine suivante"
            onClick={() => goTo(addDays(monday, 7))}
          >
            ›
          </button>
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          Sur chaque bloc noté de la semaine, tu marques ta place au classement du bloc (Elite devant RX devant Scaled). Un bloc
          non noté compte comme dernière place + 1. Le plus petit total gagne.
        </p>

        {!enabled ? (
          <Card>
            <p className="text-zinc-400">Le classement est désactivé pour cette programmation.</p>
          </Card>
        ) : boards === null ? (
          <Spinner />
        ) : boards.length === 0 ? (
          <Card>
            <p className="text-zinc-400">Aucun score cette semaine.</p>
          </Card>
        ) : (
          [boards.find((b) => b.gender === tab) ?? { gender: tab, blocks: 0, rows: [] }].map(({ gender, blocks, rows }) => (
            <div key={gender} className="mb-5">
              <GenderTabs
                value={tab}
                counts={{ male: countOf('male'), female: countOf('female') }}
                onChange={setTab}
              />
              {blocks > 0 && (
                <p className="mb-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                  {blocks} bloc{blocks > 1 ? 's' : ''}
                </p>
              )}
              {rows.length === 0 && <p className="text-sm text-zinc-500">Aucun score cette semaine.</p>}
              <ol className="flex flex-col gap-1">
                {rows.map(({ athlete: a, rank, total, places }) => (
                  <li
                    key={a.athlete_id}
                    className={`rounded-lg px-2 py-1.5 text-sm ${a.athlete_id === me ? 'bg-lime-400/10 ring-1 ring-lime-400/40' : 'bg-zinc-900'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 shrink-0 text-center text-zinc-500">{rank <= 3 ? MEDALS[rank - 1] : rank}</span>
                      <Avatar url={a.profiles?.avatar_url} name={a.profiles?.display_name} className="size-6 text-[10px]" />
                      <span className="min-w-0 truncate">{a.profiles?.display_name ?? '—'}</span>
                      {rank === 1 && <LeaderBadge />}
                      <span className="flex-1" />
                      <span className="shrink-0 font-semibold tabular-nums">{total} pts</span>
                    </div>
                    <p className="mt-0.5 pl-16 text-xs text-zinc-500 tabular-nums">
                      {places.map((p, i) => (
                        <span key={i} className={p.missed ? 'text-zinc-600' : ''}>
                          {i > 0 && ' · '}
                          {p.missed ? `(${p.place})` : p.place}
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}
        {enabled && boards && boards.length > 0 && (
          <p className="text-xs text-zinc-600">Places bloc par bloc, entre parenthèses : bloc non noté.</p>
        )}
      </div>
    </div>
  )
}
