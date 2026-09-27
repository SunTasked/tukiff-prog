import type { WorkoutDraft } from '../../domain/workout'
import { useAuth } from '../auth/AuthProvider'
import { useExercises } from '../exercises/useExercises'
import { useRecords } from '../records/useRecords'
import { WorkoutView } from '../workouts/WorkoutView'
import { BlockResults } from './BlockResults'
import { useWorkoutResults } from './useWorkoutResults'

/** Workout + score entry + leaderboards. canLog: the workout is assigned to the viewer. */
export function WorkoutWithResults({
  workout,
  canLog,
}: {
  workout: WorkoutDraft
  canLog: boolean
}) {
  const { session } = useAuth()
  const { nameOf, byId } = useExercises()
  const { results, reload } = useWorkoutResults(workout.id)
  const { oneRms } = useRecords(canLog ? session?.user.id : undefined)

  return (
    <WorkoutView
      workout={workout}
      nameOf={nameOf}
      videoOf={(id) => byId.get(id)?.video_url}
      oneRmOf={canLog ? (id) => oneRms.get(id) : undefined}
      blockFooter={(block, label) => (
        <BlockResults
          workoutId={workout.id!}
          block={block}
          blockLabel={label}
          results={results.filter((r) => r.block_id === block.id)}
          me={session?.user.id}
          canLog={canLog}
          onChange={reload}
        />
      )}
    />
  )
}
