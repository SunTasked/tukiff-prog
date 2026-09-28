import { useCallback, useEffect, useState } from 'react'
import type { WorkoutDraft } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useExercises } from '../exercises/useExercises'
import { useRecords } from '../records/useRecords'
import { WorkoutView } from '../workouts/WorkoutView'
import { BlockResults } from './BlockResults'
import { BlockReactions, type Reaction } from './BlockReactions'
import { useWorkoutResults } from './useWorkoutResults'

/**
 * Workout + score entry + leaderboards. canLog: the workout is assigned to the viewer.
 * onDone: once everything is loaded (layout stable), the ids of the blocks I scored or skipped.
 */
export function WorkoutWithResults({
  workout,
  canLog,
  onDone,
}: {
  workout: WorkoutDraft
  canLog: boolean
  onDone?: (blockIds: Set<string>) => void
}) {
  const { session } = useAuth()
  const me = session?.user.id
  const { nameOf, byId } = useExercises()
  const { results, loaded, reload } = useWorkoutResults(workout.id)
  const [reactions, setReactions] = useState<Reaction[] | null>(null)
  const reloadReactions = useCallback(async () => {
    const { data } = await supabase.from('block_reactions').select('block_id, user_id, emoji').eq('workout_id', workout.id!)
    setReactions(data ?? [])
  }, [workout.id])
  useEffect(() => {
    reloadReactions()
  }, [reloadReactions])
  // Blocks I marked "Je passe" (coaches can read everyone's, so filter on me).
  const [skips, setSkips] = useState<Set<string> | null>(canLog ? null : new Set())
  const reloadSkips = useCallback(async () => {
    if (!canLog || !me) return
    const { data } = await supabase.from('block_skips').select('block_id').eq('workout_id', workout.id!).eq('athlete_id', me)
    setSkips(new Set((data ?? []).map((s) => s.block_id)))
  }, [workout.id, canLog, me])
  useEffect(() => {
    reloadSkips()
  }, [reloadSkips])
  useEffect(() => {
    if (!onDone || !loaded || !reactions || !skips) return
    onDone(new Set([...skips, ...results.filter((r) => r.athlete_id === me).map((r) => r.block_id)]))
  }, [onDone, loaded, reactions, skips, results, me])
  const { oneRms } = useRecords(canLog ? me : undefined)

  return (
    <WorkoutView
      workout={workout}
      nameOf={nameOf}
      videoOf={(id) => byId.get(id)?.video_url}
      oneRmOf={canLog ? (id) => oneRms.get(id) : undefined}
      blockFooter={(block, label) => (
        <>
        <BlockReactions
          workoutId={workout.id!}
          blockId={block.id}
          reactions={(reactions ?? []).filter((r) => r.block_id === block.id)}
          me={me}
          canReact={canLog}
          onChange={reloadReactions}
        />
        <BlockResults
          workoutId={workout.id!}
          block={block}
          blockLabel={label}
          results={results.filter((r) => r.block_id === block.id)}
          me={me}
          canLog={canLog}
          skipped={skips?.has(block.id) ?? false}
          onChange={() => {
            reload()
            reloadSkips()
          }}
        />
        </>
      )}
    />
  )
}
