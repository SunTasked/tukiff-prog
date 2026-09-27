import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, Card, ErrorText, PageTitle, Spinner } from '../../components/ui'
import { formatLongDay, fromLocalInput, mondayOf, toLocalInput } from '../../domain/dates'
import type { WorkoutDraft } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
import { useMyPrograms } from '../programs/useMyPrograms'
import { loadWorkout } from '../workouts/api'
import { WorkoutWithResults } from '../results/WorkoutWithResults'
import { StatusBadge } from './StatusBadge'

type Meta = { date: string; publish_at: string | null; program_id: string }

const input = 'rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2'

export function ScheduledWorkoutPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { programs } = useMyPrograms()
  const [workout, setWorkout] = useState<WorkoutDraft | null>()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [publishAt, setPublishAt] = useState('')
  const [otherDate, setOtherDate] = useState('')
  const [error, setError] = useState('')
  const [missing, setMissing] = useState<string[] | null>(null)

  const load = useCallback(async () => {
    const [w, m] = await Promise.all([
      loadWorkout(id!),
      supabase.from('workouts').select('date, publish_at, program_id').eq('id', id!).single(),
    ])
    setWorkout(w)
    if (m.data) {
      const data = m.data as Meta
      setMeta(data)
      setPublishAt(data.publish_at ? toLocalInput(data.publish_at) : `${data.date}T07:00`)
      setOtherDate((d) => d || data.date)
      setMissing(await missingMembers(id!, data.program_id))
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (workout === undefined || !meta) return <Spinner />
  if (workout === null) return <p className="text-zinc-400">Séance introuvable.</p>

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p
    setError(error?.message ?? '')
    await load()
  }
  const setPublication = (value: string | null) =>
    run(supabase.from('workouts').update({ publish_at: value }).eq('id', id!))

  async function duplicate() {
    const days = Math.round((new Date(otherDate).getTime() - new Date(meta!.date).getTime()) / 86_400_000)
    const { error } = await supabase.rpc('duplicate_workouts', { p_ids: [id!], p_days: days })
    if (error) return setError(error.message)
    navigate(`/calendar?week=${mondayOf(otherDate)}`)
  }

  async function remove() {
    if (!confirm(`Supprimer « ${workout!.title} » du ${formatLongDay(meta!.date)} ?`)) return
    const { error } = await supabase.from('workouts').delete().eq('id', id!)
    if (error) setError(error.message)
    else navigate(`/calendar?week=${mondayOf(meta!.date)}`)
  }

  return (
    <>
      <Link to={`/calendar?week=${mondayOf(meta.date)}`} className="text-sm text-zinc-400">
        ‹ Programmation
      </Link>
      <PageTitle>{workout.title}</PageTitle>
      <p className="-mt-3 mb-4 text-zinc-400 capitalize">{formatLongDay(meta.date)}</p>

      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Publication</h2>
            <StatusBadge publishAt={meta.publish_at} />
          </div>
          <input type="datetime-local" className={input} value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
          <div className="flex gap-2">
            <Button className="flex-1 py-2 text-sm" disabled={!publishAt} onClick={() => setPublication(fromLocalInput(publishAt))}>
              Programmer
            </Button>
            <Button variant="secondary" className="flex-1 py-2 text-sm" onClick={() => setPublication(new Date().toISOString())}>
              Publier maintenant
            </Button>
          </div>
          {meta.publish_at && (
            <button className="text-sm text-zinc-400 underline" onClick={() => setPublication(null)}>
              Repasser en brouillon
            </button>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold">Programmation</h2>
          <select
            className={input}
            value={meta.program_id}
            onChange={(e) => run(supabase.from('workouts').update({ program_id: e.target.value }).eq('id', id!))}
          >
            {(programs ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500">Visible par les athlètes de cette programmation, une fois publiée.</p>
        </Card>

        {meta.publish_at && missing && (
          <Card>
            <h2 className="mb-1 font-semibold">Pas encore saisi ({missing.length})</h2>
            <p className="text-sm text-zinc-400">{missing.length ? missing.join(', ') : 'Tout le monde a saisi un score.'}</p>
          </Card>
        )}

        <WorkoutWithResults workout={workout} canLog={false} />

        <Button onClick={() => navigate(`/library/workouts/${id}/edit`)}>Modifier le contenu</Button>

        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold">Autre date</h2>
          <input type="date" className={input} value={otherDate} onChange={(e) => setOtherDate(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 py-2 text-sm" disabled={!otherDate} onClick={duplicate}>
              Dupliquer
            </Button>
            <Button
              variant="secondary"
              className="flex-1 py-2 text-sm"
              disabled={!otherDate || otherDate === meta.date}
              onClick={() =>
                run(
                  supabase.rpc('move_workouts', {
                    p_ids: [id!],
                    p_days: Math.round((new Date(otherDate).getTime() - new Date(meta.date).getTime()) / 86_400_000),
                  }),
                )
              }
            >
              Déplacer
            </Button>
          </div>
        </Card>

        <ErrorText>{error}</ErrorText>
        <button className="py-2 text-sm text-red-400 underline" onClick={remove}>
          Supprimer la séance
        </button>
      </div>
    </>
  )
}

/** Names of the program's athletes who have not logged any result for this workout. */
async function missingMembers(workoutId: string, programId: string): Promise<string[]> {
  const [members, results] = await Promise.all([
    supabase.from('program_members').select('user_id, profiles(display_name, role)').eq('program_id', programId),
    supabase.from('results').select('athlete_id').eq('workout_id', workoutId),
  ])
  const done = new Set((results.data ?? []).map((r) => r.athlete_id))
  return (members.data ?? [])
    .filter((m) => m.profiles?.role && !done.has(m.user_id))
    .map((m) => m.profiles?.display_name ?? '—')
    .sort((a, b) => a.localeCompare(b))
}
