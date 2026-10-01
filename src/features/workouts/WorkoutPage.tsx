import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, ErrorText, PageTitle, Spinner } from '../../components/ui'
import type { WorkoutDraft } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
import { isCoach, useAuth } from '../auth/AuthProvider'
import { useExercises } from '../exercises/useExercises'
import { loadWorkout } from './api'
import { WorkoutView } from './WorkoutView'

export function WorkoutPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { nameOf, byId, loading } = useExercises()
  const [workout, setWorkout] = useState<WorkoutDraft | null | undefined>()
  const [error, setError] = useState('')
  const coach = isCoach(useAuth().profile)

  useEffect(() => {
    loadWorkout(id!).then(setWorkout)
  }, [id])

  if (workout === undefined || loading) return <Spinner />
  if (workout === null) return <p className="text-zinc-400">Séance introuvable.</p>

  async function remove() {
    if (!confirm(`Supprimer la séance « ${workout!.title} » ?`)) return
    const { error } = await supabase.from('workouts').delete().eq('id', id!)
    if (error) setError(error.message)
    else navigate('/library')
  }

  return (
    <>
      <Link to="/library" className="text-sm text-zinc-400">
        ‹ Bibliothèque
      </Link>
      <PageTitle>{workout.title}</PageTitle>
      <WorkoutView workout={workout} nameOf={nameOf} videoOf={(eid) => byId.get(eid)?.video_url} />
      {coach && (
        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={() => navigate(`/library/workouts/${id}/edit`)}>Modifier</Button>
          <ErrorText>{error}</ErrorText>
          <button className="py-2 text-sm text-red-400 underline" onClick={remove}>
            Supprimer la séance
          </button>
        </div>
      )}
    </>
  )
}
