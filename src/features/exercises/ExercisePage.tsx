import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button, PageTitle, Spinner } from '../../components/ui'
import { MEASURES, type Measure } from '../../domain/workout'
import { supabase, type Exercise } from '../../lib/supabase'
import { isCoach, useAuth } from '../auth/AuthProvider'
import { ExerciseRecords } from '../records/LibraryRecords'

/** Library exercise, read-only, with my records. ?add=1 opens the record form (link "1RM ?" from a workout). */
export function ExercisePage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const coach = isCoach(useAuth().profile)
  const [exercise, setExercise] = useState<Exercise | null | undefined>()

  useEffect(() => {
    supabase
      .from('exercises')
      .select('*')
      .eq('id', id!)
      .maybeSingle()
      .then(({ data }) => setExercise(data))
  }, [id])

  if (exercise === undefined) return <Spinner />
  if (exercise === null) return <p className="text-zinc-400">Exercice introuvable.</p>

  return (
    <>
      <Link to="/library?tab=exercises" className="text-sm text-zinc-400">
        ‹ Bibliothèque
      </Link>
      <PageTitle>{exercise.name}</PageTitle>
      <p className="text-sm text-zinc-400">{MEASURES[exercise.measure as Measure]}</p>
      {exercise.description && <p className="mt-3 whitespace-pre-line">{exercise.description}</p>}
      {exercise.video_url && (
        <a href={exercise.video_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-lime-400 underline">
          ▶ Voir la vidéo
        </a>
      )}
      <ExerciseRecords key={exercise.id} exercise={exercise} adding={params.has('add')} />
      {coach && (
        <Button variant="secondary" className="mt-6 w-full" onClick={() => navigate(`/library/exercises/${exercise.id}/edit`)}>
          Modifier
        </Button>
      )}
    </>
  )
}
