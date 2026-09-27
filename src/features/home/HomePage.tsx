import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Card, PageTitle } from '../../components/ui'
import { addDays, formatDay, formatLongDay, today } from '../../domain/dates'
import type { WorkoutDraft } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useExercises } from '../exercises/useExercises'
import { loadWorkout } from '../workouts/api'
import { WorkoutView } from '../workouts/WorkoutView'

type Row = { id: string; title: string; date: string }

const HISTORY_DAYS = 30
const UPCOMING_DAYS = 30

/** Workouts assigned to me (athletes and coaches alike): today, upcoming, history. */
export function HomePage() {
  const { profile } = useAuth()
  const { nameOf, byId } = useExercises()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [todays, setTodays] = useState<WorkoutDraft[]>([])
  const day = today()

  useEffect(() => {
    supabase
      .rpc('my_workouts', { p_from: addDays(day, -HISTORY_DAYS), p_to: addDays(day, UPCOMING_DAYS) })
      .then(async ({ data }) => {
        const list = (data ?? []) as Row[]
        setRows(list)
        const loaded = await Promise.all(list.filter((r) => r.date === day).map((r) => loadWorkout(r.id)))
        setTodays(loaded.filter((w): w is WorkoutDraft => w !== null))
      })
  }, [day])

  const upcoming = (rows ?? []).filter((r) => r.date > day)
  const history = (rows ?? []).filter((r) => r.date < day).reverse()

  return (
    <>
      <PageTitle>Salut {profile?.display_name} 👋</PageTitle>
      <p className="-mt-3 mb-4 text-zinc-400 capitalize">{formatLongDay(day)}</p>

      <div className="flex flex-col gap-6">
        <section>
          {rows && todays.length === 0 && (
            <Card>
              <p className="text-zinc-400">Pas de séance aujourd’hui.</p>
            </Card>
          )}
          {todays.map((w) => (
            <div key={w.id} className="mb-4">
              <h2 className="mb-2 text-xl font-bold">{w.title}</h2>
              <WorkoutView workout={w} nameOf={nameOf} videoOf={(id) => byId.get(id)?.video_url} />
            </div>
          ))}
        </section>

        <WorkoutList title="À venir" rows={upcoming} empty="Rien de publié pour l’instant." />
        <WorkoutList title="Historique" rows={history} empty={`Aucune séance ces ${HISTORY_DAYS} derniers jours.`} />
      </div>
    </>
  )
}

function WorkoutList({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold tracking-widest text-zinc-500 uppercase">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-2xl bg-zinc-900">
          {rows.map((r) => (
            <li key={r.id}>
              <Link to={`/workouts/${r.id}`} className="flex justify-between gap-2 px-4 py-3">
                <span className="truncate">{r.title}</span>
                <span className="shrink-0 text-sm text-zinc-500 capitalize">{formatDay(r.date)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
