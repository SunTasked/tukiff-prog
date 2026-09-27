import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { programColor } from '../../components/ProgramBadges'
import { groupByProgram, type GroupAssignment } from '../../domain/grouping'
import { getItem, setItem } from '../../lib/storage'
import { Card, Spinner } from '../../components/ui'
import { addDays, formatLongDay, fromISODate, mondayOf, today, weekDays } from '../../domain/dates'
import type { WorkoutDraft } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { WorkoutWithResults } from '../results/WorkoutWithResults'
import { loadWorkout } from '../workouts/api'

type Row = { id: string; title: string; date: string }

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Workouts assigned to me, one day at a time, with a week strip to navigate. */
export function HomePage() {
  const { profile, session } = useAuth()
  const [params, setParams] = useSearchParams()
  const day = params.get('day') ?? today()
  const monday = mondayOf(day)
  const [week, setWeek] = useState<Row[] | null>(null)
  const [assignments, setAssignments] = useState<Record<string, GroupAssignment[]>>({})
  const [myPrograms, setMyPrograms] = useState<Set<string>>(new Set())
  const [workouts, setWorkouts] = useState<WorkoutDraft[] | null>(null)

  const goTo = (d: string) => setParams(d === today() ? {} : { day: d }, { replace: true })

  useEffect(() => {
    supabase.rpc('my_workouts', { p_from: monday, p_to: addDays(monday, 6) }).then(async ({ data }) => {
      const rows = (data ?? []) as Row[]
      setWeek(rows)
      if (!rows.length) return setAssignments({})
      const { data: assignments } = await supabase
        .from('workout_assignments')
        .select('workout_id, program_id, athlete_id, programs(name)')
        .in('workout_id', rows.map((r) => r.id))
      const byWorkout: Record<string, GroupAssignment[]> = {}
      for (const a of assignments ?? []) (byWorkout[a.workout_id] ??= []).push(a)
      setAssignments(byWorkout)
    })
  }, [monday])

  useEffect(() => {
    if (!session) return
    supabase
      .from('program_members')
      .select('program_id')
      .eq('user_id', session.user.id)
      .then(({ data }) => setMyPrograms(new Set((data ?? []).map((r) => r.program_id))))
  }, [session])

  useEffect(() => {
    if (!week) return
    setWorkouts(null)
    Promise.all(week.filter((r) => r.date === day).map((r) => loadWorkout(r.id))).then((list) =>
      setWorkouts(list.filter((w): w is WorkoutDraft => w !== null)),
    )
  }, [week, day])

  return (
    <>
      <h1 className="text-2xl font-bold">Salut {profile?.display_name} 👋</h1>

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
            const has = week?.some((r) => r.date === d)
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
        groupByProgram(workouts, assignments, myPrograms, session?.user.id).map((panel) => (
          <ProgramPanel key={panel.key} panelKey={panel.key} label={panel.label} programName={panel.programName}>
            {panel.items.map((w) => (
              <div key={w.id}>
                <h2 className="mb-2 text-xl font-bold">{w.title}</h2>
                <WorkoutWithResults workout={w} canLog />
              </div>
            ))}
          </ProgramPanel>
        ))
      )}
    </>
  )
}

/** Collapsible panel for one program; the collapsed state is remembered on the device. */
function ProgramPanel({
  panelKey,
  label,
  programName,
  children,
}: {
  panelKey: string
  label: string
  programName: string | null
  children: ReactNode
}) {
  const storageKey = `panel-collapsed:${panelKey}`
  const [open, setOpen] = useState(() => getItem(storageKey) !== '1')
  const toggle = () => {
    setItem(storageKey, open ? '1' : null)
    setOpen(!open)
  }
  const accent = programName ? programColor(programName) : 'bg-zinc-800 text-zinc-300'

  return (
    <section className="mb-4 rounded-2xl border border-zinc-800">
      <button className="flex w-full items-center justify-between gap-2 p-3" onClick={toggle} aria-expanded={open}>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${accent}`}>{label}</span>
        <span className="text-zinc-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="flex flex-col gap-6 px-3 pb-3">{children}</div>}
    </section>
  )
}
