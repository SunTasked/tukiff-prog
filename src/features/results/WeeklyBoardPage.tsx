import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { Card, PageTitle, Spinner } from '../../components/ui'
import { addDays, formatWeek, mondayOf, publicationStatus, today } from '../../domain/dates'
import type { Gender } from '../../domain/profile'
import { scoreType, weeklyLeaderboards } from '../../domain/scoring'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { loadWorkout } from '../workouts/api'
import type { ResultRow } from './useWorkoutResults'

type Athlete = ResultRow & { gender: Gender | null }
type Row = { id: string; program_id: string; program_name: string; publish_at: string | null }

const MEDALS = ['🥇', '🥈', '🥉']
const BOARD_TITLES = { male: 'Hommes', female: 'Femmes' }

/** Weekly leaderboard of one program (Monday to Sunday), from the published workouts of the week. */
export function WeeklyBoardPage() {
  const { programId } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const me = session?.user.id
  const monday = mondayOf(params.get('week') ?? today())
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [boards, setBoards] = useState<ReturnType<typeof weeklyLeaderboards<Athlete>> | null>(null)

  useEffect(() => {
    let live = true
    setBoards(null)
    ;(async () => {
      const [{ data: week }, { data: program }] = await Promise.all([
        supabase.rpc('my_workouts', { p_from: monday, p_to: addDays(monday, 6) }),
        supabase.from('programs').select('name, leaderboard_enabled').eq('id', programId!).maybeSingle(),
      ])
      const ids = ((week ?? []) as Row[])
        .filter((w) => w.program_id === programId && publicationStatus(w.publish_at) === 'published')
        .map((w) => w.id)
      const [workouts, { data: results }] = await Promise.all([
        Promise.all(ids.map(loadWorkout)),
        ids.length
          ? supabase.from('results').select('*, profiles(display_name, gender, avatar_url)').in('workout_id', ids)
          : Promise.resolve({ data: [] }),
      ])
      if (!live) return
      const rows: Athlete[] = ((results ?? []) as ResultRow[]).map((r) => ({ ...r, gender: r.profiles?.gender ?? null }))
      setName(program?.name ?? (week as Row[] | null)?.find((w) => w.program_id === programId)?.program_name ?? '')
      setEnabled(program?.leaderboard_enabled ?? true)
      setBoards(
        weeklyLeaderboards(
          workouts.flatMap((w) =>
            (w?.blocks ?? []).map((b) => ({ type: scoreType(b.format, b.params), results: rows.filter((r) => r.block_id === b.id) })),
          ),
        ),
      )
    })()
    return () => {
      live = false
    }
  }, [programId, monday])

  const goTo = (d: string) => setParams(d === mondayOf(today()) ? {} : { week: d }, { replace: true })

  return (
    <>
      <button onClick={() => navigate(-1)} className="text-sm text-zinc-400">
        ‹ Retour
      </button>
      <PageTitle>Classement de la semaine</PageTitle>
      {name && <p className="-mt-3 mb-3 text-zinc-400">{name}</p>}
      <div className="mb-3 flex items-center justify-between">
        <button className="px-2 py-1 text-xl text-zinc-400" aria-label="Semaine précédente" onClick={() => goTo(addDays(monday, -7))}>
          ‹
        </button>
        <span className="font-semibold">{formatWeek(monday)}</span>
        <button className="px-2 py-1 text-xl text-zinc-400" aria-label="Semaine suivante" onClick={() => goTo(addDays(monday, 7))}>
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
        boards.map(({ gender, blocks, rows }) => (
          <div key={gender} className="mb-5">
            <p className="mb-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
              {BOARD_TITLES[gender]} · {blocks} bloc{blocks > 1 ? 's' : ''}
            </p>
            <ol className="flex flex-col gap-1">
              {rows.map(({ athlete: a, rank, total, places }) => (
                <li
                  key={a.athlete_id}
                  className={`rounded-lg px-2 py-1.5 text-sm ${a.athlete_id === me ? 'bg-lime-400/10 ring-1 ring-lime-400/40' : 'bg-zinc-900'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-center text-zinc-500">{rank <= 3 ? MEDALS[rank - 1] : rank}</span>
                    <Avatar url={a.profiles?.avatar_url} name={a.profiles?.display_name} className="size-6 text-[10px]" />
                    <span className="min-w-0 flex-1 truncate">{a.profiles?.display_name ?? '—'}</span>
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
    </>
  )
}
