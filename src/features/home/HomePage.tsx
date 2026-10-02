import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { programColor, programPanelColor } from '../../components/ProgramBadges'
import { compareWorkouts, firstPendingBlock, groupByProgram } from '../../domain/grouping'
import { unreadMessages } from '../../lib/releases'
import { useOnResume } from '../../lib/resume'
import { getItem, setItem } from '../../lib/storage'
import { Card, Spinner } from '../../components/ui'
import { addDays, coversDay, formatDay, formatLongDay, lastDay, fromISODate, mondayOf, publicationStatus, today, weekDays } from '../../domain/dates'
import { StatusBadge } from '../calendar/StatusBadge'
import { viewAs, type AccessLevel, type WorkoutDraft } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { WeeklyBoardSheet } from '../results/WeeklyBoardSheet'
import { WorkoutWithResults } from '../results/WorkoutWithResults'
import { loadWorkout } from '../workouts/api'

type Row = { id: string; title: string; date: string; days: number; program_id: string; program_name: string; publish_at: string | null }

/** Diagonal stripes marking a workout athletes can't see yet (only its program's coaches get it). */
const HATCHED =
  'rounded-xl bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.05)_0_10px,transparent_10px_20px)] p-2 outline outline-1 outline-dashed outline-amber-400/40'

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Workouts assigned to me, one day at a time, with a week strip to navigate. */
export function HomePage() {
  const { session, profile } = useAuth()
  const unread = unreadMessages(profile)
  const me = session?.user.id
  const [params, setParams] = useSearchParams()
  const day = params.get('day') ?? today()
  const monday = mondayOf(day)
  const [week, setWeek] = useState<Row[] | null>(null)
  const [workouts, setWorkouts] = useState<(WorkoutDraft & Row)[] | null>(null)

  // Auto-scroll, once per day shown, to the first block of the open panels I neither scored nor skipped.
  const done = useRef(new Map<string, Set<string>>())
  const scrolledDay = useRef<string | null>(null)
  const report = (workoutId: string, blockIds: Set<string>) => {
    done.current.set(workoutId, blockIds)
    if (!workouts || scrolledDay.current === day) return
    const open = groupByProgram(workouts)
      .filter((p) => getItem(panelStorageKey(p.key)) !== '1')
      .flatMap((p) => p.items)
    if (!open.every((w) => done.current.has(w.id))) return
    scrolledDay.current = day
    const target = firstPendingBlock(open, done.current)
    if (target) document.getElementById(`block-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const goTo = (d: string) => setParams(d === today() ? {} : { day: d }, { replace: true })

  const loadWeek = useCallback(
    () =>
      supabase
        .rpc('my_workouts', { p_from: monday, p_to: addDays(monday, 6) })
        // Same rows: keep the previous array so the open sessions aren't reloaded for nothing.
        .then(({ data }) => setWeek((prev) => (JSON.stringify(prev) === JSON.stringify(data ?? []) ? prev : ((data ?? []) as Row[])))),
    [monday],
  )
  useEffect(() => {
    loadWeek()
  }, [loadWeek])
  // On return: re-render so "today" follows the clock (overnight), and fetch sessions published meanwhile.
  const [, setResumes] = useState(0)
  useOnResume(() => {
    setResumes((n) => n + 1)
    loadWeek()
  })

  const [weekBoard, setWeekBoard] = useState<{ key: string; label: string } | null>(null)
  // Programs of the week with the leaderboard turned off: no link to their weekly board.
  const [boardOff, setBoardOff] = useState<Set<string>>(new Set())
  // Programs I coach that have access levels, with my own level as a member: I see every block, and can switch to
  // what an athlete of my level sees ("🔎 Athlète").
  const [coached, setCoached] = useState<Map<string, number>>(new Map())
  const [athleteView, setAthleteView] = useState<Set<string>>(new Set())
  const programIds = [...new Set((week ?? []).map((r) => r.program_id))].sort().join(',')
  useEffect(() => {
    if (!programIds) return
    Promise.all([
      supabase
        .from('programs')
        .select('id, leaderboard_enabled, owner_id, access_levels, program_coaches(coach_id)')
        .in('id', programIds.split(',')),
      supabase.from('program_members').select('program_id, level').eq('user_id', me!).in('program_id', programIds.split(',')),
    ]).then(([{ data }, { data: mine }]) => {
      setBoardOff(new Set((data ?? []).filter((p) => !p.leaderboard_enabled).map((p) => p.id)))
      const myLevel = new Map((mine ?? []).map((m) => [m.program_id, m.level]))
      setCoached(
        new Map(
          (data ?? [])
            .filter((p) => (p.owner_id === me || p.program_coaches.some((c) => c.coach_id === me)) && (p.access_levels as AccessLevel[]).length)
            .map((p) => [p.id, myLevel.get(p.id) ?? 0]),
        ),
      )
    })
  }, [programIds, me])

  useEffect(() => {
    if (!week) return
    setWorkouts(null)
    done.current = new Map()
    // Multi-day workouts (challenges) show every day of their range, after the day's workouts.
    const rows = week.filter((r) => coversDay(r.date, r.days, day)).sort(
        (a, b) =>
          Number(a.days > 1) - Number(b.days > 1) ||
          compareWorkouts({ ...a, program: a.program_name }, { ...b, program: b.program_name }),
      )
    Promise.all(rows.map((r) => loadWorkout(r.id))).then((list) =>
      setWorkouts(list.flatMap((w, i) => (w ? [{ ...w, ...rows[i] }] : []))),
    )
  }, [week, day])

  return (
    <>
      <div className="flex items-center justify-between">
        {/* mix-blend-screen makes the logo's black background disappear on the dark page */}
        <img src="/tkf-logo.jpg" alt="TKF Programming" className="h-14 w-auto mix-blend-screen lg:invisible" />
        <div className="flex items-center gap-2">
          <Link to="/timer" className="rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-semibold">
            ⏱️ Timer
          </Link>
          <Link to="/messages" aria-label={unread ? 'Messages (nouveau)' : 'Messages'} className="relative rounded-full bg-zinc-900 p-2 text-zinc-300">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {unread && <span className="absolute top-1 right-1 size-2.5 rounded-full bg-red-500 ring-2 ring-zinc-950" />}
          </Link>
        </div>
      </div>

      <div className="mt-3 mb-4">
        <div className="flex items-center justify-between">
          <button className="px-2 py-1 text-xl text-zinc-400" aria-label="Semaine précédente" onClick={() => goTo(addDays(day, -7))}>
            ‹
          </button>
          <span className="font-semibold capitalize">{formatLongDay(day)}</span>
          <button className="px-2 py-1 text-xl text-zinc-400" aria-label="Semaine suivante" onClick={() => goTo(addDays(day, 7))}>
            ›
          </button>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {weekDays(monday).map((d, i) => {
            const has = week?.some((r) => coversDay(r.date, r.days, d))
            const selected = d === day
            return (
              <button
                key={d}
                onClick={() => goTo(d)}
                className={`flex flex-col items-center rounded-xl py-1.5 text-sm ${
                  selected ? 'bg-lime-400 font-bold text-zinc-950' : d === today() ? 'text-lime-400' : 'text-zinc-300'
                }`}
              >
                <span className={`text-xs ${selected ? '' : 'text-zinc-500'}`}>{DAY_LETTERS[i]}</span>
                {fromISODate(d).getDate()}
                <span className={`mt-0.5 size-1.5 rounded-full ${has ? (selected ? 'bg-zinc-950' : 'bg-lime-400') : ''}`} />
              </button>
            )
          })}
        </div>
        {day !== today() && (
          <button className="mt-1 w-full text-center text-xs text-lime-400" onClick={() => goTo(today())}>
            Revenir à aujourd’hui
          </button>
        )}
      </div>

      {workouts === null ? (
        <Spinner />
      ) : workouts.length === 0 ? (
        <Card>
          <p className="text-zinc-400">Pas de séance ce jour-là.</p>
        </Card>
      ) : (
        groupByProgram(workouts).map((panel) => {
          const myLevel = coached.get(panel.key)
          const asAthlete = myLevel !== undefined && athleteView.has(panel.key)
          return (
          <ProgramPanel key={panel.key} panelKey={panel.key} label={panel.label}>
            {(!boardOff.has(panel.key) || myLevel !== undefined) && (
              <div className="-mb-3 flex items-center justify-between gap-2">
                {!boardOff.has(panel.key) ? (
                  <button className="text-sm whitespace-nowrap text-lime-400" onClick={() => setWeekBoard(panel)}>
                    🏆 Classement de la semaine ›
                  </button>
                ) : (
                  <span />
                )}
                {myLevel !== undefined && (
                  <button
                    role="switch"
                    aria-checked={asAthlete}
                    className={`flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap ${asAthlete ? 'text-amber-300' : 'text-zinc-400'}`}
                    onClick={() =>
                      setAthleteView((prev) => {
                        const next = new Set(prev)
                        if (!next.delete(panel.key)) next.add(panel.key)
                        return next
                      })
                    }
                  >
                    🔎 Athlète
                    <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${asAthlete ? 'bg-amber-400' : 'bg-zinc-700'}`}>
                      <span className={`size-4 rounded-full bg-zinc-950 transition-transform ${asAthlete ? 'translate-x-4' : ''}`} />
                    </span>
                  </button>
                )}
              </div>
            )}
            {panel.items.map((w) => {
              const published = publicationStatus(w.publish_at) === 'published'
              return (
                <div key={w.id} className={published ? '' : HATCHED}>
                  <h2 className="mb-2 text-xl font-bold">{w.title}</h2>
                  {w.days > 1 && (
                    <p className="-mt-1 mb-2 text-xs text-amber-300">
                      🗓 Du {formatDay(w.date)} au {formatDay(lastDay(w.date, w.days))}
                    </p>
                  )}
                  {!published && (
                    <p className="-mt-1 mb-2">
                      <StatusBadge publishAt={w.publish_at} /> <span className="text-xs text-zinc-400">· non visible des athlètes</span>
                    </p>
                  )}
                  <WorkoutWithResults workout={asAthlete ? viewAs(w, myLevel) : w} canLog={published}
                    // Unpublished: nothing to log, so never the auto-scroll target.
                    onDone={(ids) => report(w.id, published ? ids : new Set(w.blocks.map((b) => b.id)))}
                  />
                </div>
              )
            })}
          </ProgramPanel>
          )
        })
      )}
      {weekBoard && (
        <WeeklyBoardSheet programId={weekBoard.key} programName={weekBoard.label} week={monday} onClose={() => setWeekBoard(null)} />
      )}
    </>
  )
}

const panelStorageKey = (panelKey: string) => `panel-collapsed:${panelKey}`

/** Collapsible panel for one program; the collapsed state is remembered on the device. */
function ProgramPanel({
  panelKey,
  label,
  children,
}: {
  panelKey: string
  label: string
  children: ReactNode
}) {
  const storageKey = panelStorageKey(panelKey)
  const [open, setOpen] = useState(() => getItem(storageKey) !== '1')
  const toggle = () => {
    setItem(storageKey, open ? '1' : null)
    setOpen(!open)
  }
  const accent = programColor(label)

  return (
    <section className={`mb-4 rounded-2xl border ${programPanelColor(label)}`}>
      <button className="flex w-full items-center justify-between gap-2 p-3" onClick={toggle} aria-expanded={open}>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${accent}`}>{label}</span>
        <span className="text-zinc-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="flex flex-col gap-6 px-3 pb-3">{children}</div>}
    </section>
  )
}
