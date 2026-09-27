import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PageTitle, Spinner } from '../../components/ui'
import { formatLongDay } from '../../domain/dates'
import type { WorkoutDraft } from '../../domain/workout'
import { useExercises } from '../exercises/useExercises'
import { loadWorkout } from '../workouts/api'
import { WorkoutView } from '../workouts/WorkoutView'

export function AthleteWorkoutPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { nameOf, byId } = useExercises()
  const [workout, setWorkout] = useState<WorkoutDraft | null>()

  useEffect(() => {
    loadWorkout(id!).then(setWorkout)
  }, [id])

  if (workout === undefined) return <Spinner />
  if (workout === null) return <p className="text-zinc-400">Séance introuvable ou pas encore publiée.</p>

  return (
    <>
      <button onClick={() => navigate(-1)} className="text-sm text-zinc-400">
        ‹ Retour
      </button>
      <PageTitle>{workout.title}</PageTitle>
      {workout.date && <p className="-mt-3 mb-4 text-zinc-400 capitalize">{formatLongDay(workout.date)}</p>}
      <WorkoutView workout={workout} nameOf={nameOf} videoOf={(eid) => byId.get(eid)?.video_url} />
    </>
  )
}
