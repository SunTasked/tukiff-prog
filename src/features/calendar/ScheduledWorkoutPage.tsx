import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, Card, ErrorText, PageTitle, Spinner } from '../../components/ui'
import { formatLongDay, fromLocalInput, mondayOf, toLocalInput } from '../../domain/dates'
import type { WorkoutDraft } from '../../domain/workout'
import { supabase, type Assignment } from '../../lib/supabase'
import { useTeam } from '../programs/useTeam'
import { loadWorkout } from '../workouts/api'
import { WorkoutWithResults } from '../results/WorkoutWithResults'
import { StatusBadge } from './StatusBadge'
import { isEveryone } from './targets'

type Meta = { date: string; publish_at: string | null; workout_assignments: (Assignment & { id: string })[] }

const input = 'rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2'

export function ScheduledWorkoutPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { programs, members } = useTeam()
  const [workout, setWorkout] = useState<WorkoutDraft | null>()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [publishAt, setPublishAt] = useState('')
  const [otherDate, setOtherDate] = useState('')
  const [error, setError] = useState('')
  const [missing, setMissing] = useState<string[] | null>(null)

  const load = useCallback(async () => {
    const [w, m] = await Promise.all([
      loadWorkout(id!),
      supabase.from('workouts').select('date, publish_at, workout_assignments(id, program_id, athlete_id)').eq('id', id!).single(),
    ])
    setWorkout(w)
    if (m.data) {
      const data = m.data as Meta
      setMeta(data)
      setPublishAt(data.publish_at ? toLocalInput(data.publish_at) : `${data.date}T07:00`)
      setOtherDate((d) => d || data.date)
      setMissing(await missingMembers(id!, data.workout_assignments))
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

  const has = (t: Assignment) =>
    meta.workout_assignments.find((a) => a.program_id === t.program_id && a.athlete_id === t.athlete_id)
  const toggle = (t: Assignment) => {
    const existing = has(t)
    run(
      existing
        ? supabase.from('workout_assignments').delete().eq('id', existing.id)
        : supabase.from('workout_assignments').insert({ workout_id: id!, ...t }),
    )
  }

  async function duplicate() {
    const { data, error } = await supabase.rpc('duplicate_workout', { p_id: id!, p_date: otherDate })
    if (error) return setError(error.message)
    navigate(`/calendar/workouts/${data}`)
  }

  async function remove() {
    if (!confirm(`Supprimer « ${workout!.title} » du ${formatLongDay(meta!.date)} ?`)) return
    const { error } = await supabase.from('workouts').delete().eq('id', id!)
    if (error) setError(error.message)
    else navigate(`/calendar?week=${mondayOf(meta!.date)}`)
  }

  const targets: { label: string; t: Assignment }[] = [
    { label: 'Tous', t: { program_id: null, athlete_id: null } },
    ...programs.map((p) => ({ label: `Programme · ${p.name}`, t: { program_id: p.id, athlete_id: null } })),
    ...members.map((m) => ({ label: m.display_name ?? '—', t: { program_id: null, athlete_id: m.id } })),
  ]

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

        <Card>
          <h2 className="mb-2 font-semibold">Pour qui ?</h2>
          {meta.workout_assignments.length === 0 && (
            <p className="mb-2 text-sm text-amber-400">Aucune cible : personne ne verra cette séance.</p>
          )}
          <ul className="flex flex-col">
            {targets.map(({ label, t }) => (
              <li key={`${t.program_id}-${t.athlete_id}`}>
                <label className="flex items-center gap-3 py-1.5">
                  <input type="checkbox" className="size-5 accent-lime-400" checked={!!has(t)} onChange={() => toggle(t)} />
                  <span className={isEveryone(t) ? 'font-semibold' : ''}>{label}</span>
                </label>
              </li>
            ))}
          </ul>
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
              onClick={() => run(supabase.from('workouts').update({ date: otherDate }).eq('id', id!))}
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

/** Names of assigned members who have not logged any result for this workout. */
async function missingMembers(workoutId: string, assignments: Assignment[]): Promise<string[]> {
  const everyone = assignments.some(isEveryone)
  const programIds = assignments.flatMap((a) => (a.program_id ? [a.program_id] : []))
  const [members, inPrograms, results] = await Promise.all([
    supabase.from('profiles').select('id, display_name').not('role', 'is', null).order('display_name'),
    programIds.length
      ? supabase.from('program_members').select('user_id').in('program_id', programIds)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    supabase.from('results').select('athlete_id').eq('workout_id', workoutId),
  ])
  const assigned = new Set([
    ...(inPrograms.data ?? []).map((r) => r.user_id),
    ...assignments.flatMap((a) => (a.athlete_id ? [a.athlete_id] : [])),
  ])
  const done = new Set((results.data ?? []).map((r) => r.athlete_id))
  return (members.data ?? [])
    .filter((m) => (everyone || assigned.has(m.id)) && !done.has(m.id))
    .map((m) => m.display_name ?? '—')
}
