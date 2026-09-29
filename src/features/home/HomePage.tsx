import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { programColor, programPanelColor } from '../../components/ProgramBadges'
import { firstPendingBlock, groupByProgram } from '../../domain/grouping'
import { useOnResume } from '../../lib/resume'
import { getItem, setItem } from '../../lib/storage'
import { Card, Spinner } from '../../components/ui'
import { addDays, coversDay, formatDay, formatLongDay, lastDay, fromISODate, mondayOf, publicationStatus, today, weekDays } from '../../domain/dates'
import { StatusBadge } from '../calendar/StatusBadge'
import type { WorkoutDraft } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
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
  const programIds = [...new Set((week ?? []).map((r) => r.program_id))].sort().join(',')
  useEffect(() => {
    if (!programIds) return
    supabase
      .from('programs')
      .select('id, leaderboard_enabled')
      .in('id', programIds.split(','))
      .then(({ data }) => setBoardOff(new Set((data ?? []).filter((p) => !p.leaderboard_enabled).map((p) => p.id))))
  }, [programIds])

  useEffect(() => {
    if (!week) return
    setWorkouts(null)
    done.current = new Map()
    // Multi-day workouts (challenges) show every day of their range, after the day's workouts.
    const rows = week.filter((r) => coversDay(r.date, r.days, day)).sort((a, b) => Number(a.days > 1) - Number(b.days > 1))
    Promise.all(rows.map((r) => loadWorkout(r.id))).then((list) =>
      setWorkouts(list.flatMap((w, i) => (w ? [{ ...w, ...rows[i] }] : []))),
    )
  }, [week, day])

  return (
    <>
      <div className="flex items-center justify-between">
        {/* mix-blend-screen makes the logo's black background disappear on the dark page */}
        <img src="/tkf-logo.jpg" alt="TKF Programming" className="h-14 w-auto mix-blend-screen lg:invisible" />
        <Link to="/timer" className="rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-semibold">
          ⏱ Timer
        </Link>
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
        groupByProgram(workouts).map((panel) => (
          <ProgramPanel key={panel.key} panelKey={panel.key} label={panel.label}>
            {!boardOff.has(panel.key) && (
              <button className="-mb-3 self-start text-sm text-lime-400" onClick={() => setWeekBoard(panel)}>
                🏆 Classement de la semaine ›
              </button>
            )}
            {panel.items.map((w) => {
              const published = publicationStatus(w.publish_at) === 'published'
              return (
                <div key={w.id} className={published ? '' : HATCHED}>
                  <h2 className="mb-2 text-xl font-bold">{w.title}</h2>
                  {w.days > 1 && (
                    <p className="-mt-1 mb-2 text-xs text-amber-300">
                      🗓 Du {formatDay(w.date)} au {formatDay(lastDay(w.date, w.days))} · un seul score
                    </p>
                  )}
                  {!published && (
                    <p className="-mt-1 mb-2">
                      <StatusBadge publishAt={w.publish_at} /> <span className="text-xs text-zinc-400">· non visible des athlètes</span>
                    </p>
                  )}
                  <WorkoutWithResults workout={w} canLog={published}
                    // Unpublished: nothing to log, so never the auto-scroll target.
                    onDone={(ids) => report(w.id, published ? ids : new Set(w.blocks.map((b) => b.id)))}
                  />
                </div>
              )
            })}
          </ProgramPanel>
        ))
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
