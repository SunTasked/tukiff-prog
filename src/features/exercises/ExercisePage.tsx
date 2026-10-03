import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { PageTitle, Spinner } from '../../components/ui'
import { MEASURES, type Measure } from '../../domain/workout'
import { supabase, type Exercise } from '../../lib/supabase'
import { ExerciseRecords } from '../records/LibraryRecords'

/**
 * Library exercise, read-only, with my records. ?add=1 opens the record form (link "1RM ?" from a workout).
 * As a movement benchmark (category "Mouvements" of the benchmarks), it also shows the box leaderboard.
 */
export function ExercisePage({ benchmark = false }: { benchmark?: boolean }) {
  const { id } = useParams()
  const [params] = useSearchParams()
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
      <Link to={benchmark ? '/library' : '/library?tab=exercises'} className="text-sm text-zinc-400">
        ‹ PR
      </Link>
      <PageTitle>{exercise.name}</PageTitle>
      <p className="text-sm text-zinc-400">{MEASURES[exercise.measure as Measure]}</p>
      {exercise.description && <p className="mt-3 whitespace-pre-line">{exercise.description}</p>}
      {exercise.video_url && (
        <a href={exercise.video_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-lime-400 underline">
          ▶ Voir la vidéo
        </a>
      )}
      <ExerciseRecords key={exercise.id} exercise={exercise} adding={params.has('add')} board={benchmark} />
    </>
  )
}
