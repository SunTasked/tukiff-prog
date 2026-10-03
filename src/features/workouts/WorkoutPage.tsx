import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { PageTitle, Spinner } from '../../components/ui'
import type { WorkoutDraft } from '../../domain/workout'
import { useExercises } from '../exercises/useExercises'
import { BenchmarkRecords } from '../records/LibraryRecords'
import { loadWorkout } from './api'
import { WorkoutView } from './WorkoutView'

/** Library benchmark, read-only for everyone (its content is fed through the database), with my records. */
export function WorkoutPage() {
  const { id } = useParams()
  const { nameOf, byId, loading } = useExercises()
  const [workout, setWorkout] = useState<WorkoutDraft | null | undefined>()

  useEffect(() => {
    loadWorkout(id!).then(setWorkout)
  }, [id])

  if (workout === undefined || loading) return <Spinner />
  if (workout === null) return <p className="text-zinc-400">Benchmark introuvable.</p>

  return (
    <>
      <Link to="/library" className="text-sm text-zinc-400">
        ‹ PR
      </Link>
      <PageTitle>{workout.title}</PageTitle>
      <WorkoutView workout={workout} nameOf={nameOf} videoOf={(eid) => byId.get(eid)?.video_url} />
      <BenchmarkRecords key={workout.id} workout={{ id: workout.id!, title: workout.title, blocks: workout.blocks }} />
    </>
  )
}
