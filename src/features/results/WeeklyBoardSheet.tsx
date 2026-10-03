import { useEffect, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { Card, CloseButton, HelpBubble, HelpButton, Spinner } from '../../components/ui'
import { addDays, formatWeek, mondayOf, weekClosed } from '../../domain/dates'
import { scoreName, type Gender } from '../../domain/profile'
import { AthleteName } from './AthleteName'
import { useAuth } from '../auth/AuthProvider'
import { GenderTabs } from './GenderTabs'
import { LeaderBadge } from './LeaderBadge'
import { useCrowns } from './palmares'
import { loadWeeklyBoards, type WeeklyBoards } from './weeklyBoards'

const MEDALS = ['🥇', '🥈', '🥉']
const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`)

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
  const [open, setOpen] = useState<string | null>(null)
  const [help, setHelp] = useState(false)
  const crowns = useCrowns()
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
      <div className="relative flex items-center justify-between border-b border-zinc-800 p-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold">Classement de la semaine · {programName}</span>
          <HelpButton open={help} onClick={() => setHelp(!help)} label="Comment sont comptés les points" />
        </span>
        <CloseButton onClick={onClose} />
        {help && <HelpBubble text={WEEKLY_HELP} onClose={() => setHelp(false)} className="top-full right-3 left-3 mt-1" />}
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
          <span className="flex flex-col items-center">
            <span className="font-semibold">{formatWeek(monday)}</span>
            {weekClosed(monday) && <span className="text-xs text-zinc-500">🔒 Semaine terminée</span>}
          </span>
          <button
            className="px-2 py-1 text-xl text-zinc-400"
            aria-label="Semaine suivante"
            onClick={() => goTo(addDays(monday, 7))}
          >
            ›
          </button>
        </div>
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
          [boards.find((b) => b.gender === tab) ?? { gender: tab, blocks: 0, labels: [], bonus: [], rows: [] }].map(({ gender, blocks, labels, bonus, rows }) => (
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
                {rows.map(({ athlete: a, rank, total, places, crown }) => (
                  <li
                    key={a.athlete_id}
                    className={`cursor-pointer rounded-lg px-2 py-1.5 text-sm ${a.athlete_id === me ? 'bg-lime-400/10 ring-1 ring-lime-400/40' : 'bg-zinc-900'}`}
                    onClick={() => setOpen(open === a.athlete_id ? null : a.athlete_id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 shrink-0 text-center text-zinc-500">{rank <= 3 ? MEDALS[rank - 1] : rank}</span>
                      <Avatar url={a.profiles?.avatar_url} name={scoreName(a.profiles)} crown={crowns.has(a.athlete_id)} className="size-6 text-[10px]" />
                      <AthleteName profile={a.profiles} />
                      {rank === 1 && <LeaderBadge gold={crown} />}
                      <span className="flex-1" />
                      <span className="shrink-0 font-semibold tabular-nums">
                        {total} pts
                      </span>
                      <span className="shrink-0 text-xs text-zinc-500">{open === a.athlete_id ? '▴' : '▾'}</span>
                    </div>
                    {open === a.athlete_id && (
                      <ul className="mt-1 flex flex-col gap-0.5 pl-16 text-xs text-zinc-400">
                        {places.map((p, i) =>
                          p.counted || (bonus[i] && !p.missed) ? (
                            <li key={i} className="flex gap-2">
                              <span className="min-w-0 flex-1 truncate">
                                {labels[i]}
                                {bonus[i] && ' (départage)'}
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {p.missed ? 'absent' : ordinal(p.place)}
                                {!bonus[i] && ` · ${p.points} pt${p.points > 1 ? 's' : ''}`}
                              </span>
                            </li>
                          ) : null,
                        )}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}
        {enabled && boards && boards.length > 0 && (
          <p className="text-xs text-zinc-600">Touche un athlète pour voir les blocs qui comptent.</p>
        )}
      </div>
    </div>
  )
}

const WEEKLY_HELP = `**Points par bloc classé** (score RX) :
- 1er : **10 pts**, 2e : 9 pts… 10e : 1 pt
- au-delà, en adapté ou sans score : 0 pt

**Total** = tes **3 meilleurs blocs**. Le plus grand total gagne.

Le **challenge** ne rapporte pas de points : il **départage les égalités**.

**LEADER** en or à 3 blocs gagnés (30 pts) : couronne sur ta photo la semaine suivante.

🔒 Fin de semaine le **dimanche à 23:59** : scores figés, le leader entre dans son palmarès.`
