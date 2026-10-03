import { useCallback, useEffect, useState } from 'react'
import type { WorkoutDraft } from '../../domain/workout'
import { useOnResume } from '../../lib/resume'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useExercises } from '../exercises/useExercises'
import { SaveAsRecord } from '../records/SaveAsRecord'
import { useRecords } from '../records/useRecords'
import { WorkoutView } from '../workouts/WorkoutView'
import { BlockResults } from './BlockResults'
import { useClaps } from './useClaps'
import { useWorkoutResults } from './useWorkoutResults'
import { useWeekLeaders } from './weeklyBoards'

/** Workout + score entry + leaderboards. canLog: the workout is assigned to the viewer. */
export function WorkoutWithResults({
  workout,
  canLog,
}: {
  workout: WorkoutDraft
  canLog: boolean
}) {
  const { session } = useAuth()
  const me = session?.user.id
  const { nameOf, byId } = useExercises()
  const { results, loaded, reload } = useWorkoutResults(workout.id)
  // Claps (programs.reactions_enabled) and leaderboard can be turned off per program (athletes then only see their own score).
  const [settings, setSettings] = useState<{ claps: boolean } | null>(null)
  const [boardOn, setBoardOn] = useState(true)
  const [programId, setProgramId] = useState<string | null>(null)
  const reloadSettings = useCallback(async () => {
    const { data: w } = await supabase
      .from('workouts')
      .select('program_id, programs(reactions_enabled, leaderboard_enabled)')
      .eq('id', workout.id!)
      .single()
    setSettings({ claps: w?.programs?.reactions_enabled ?? true })
    setBoardOn(w?.programs?.leaderboard_enabled ?? true)
    setProgramId(w?.program_id ?? null)
  }, [workout.id])
  useEffect(() => {
    reloadSettings()
  }, [reloadSettings])
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
  useOnResume(() => {
    reloadSettings()
    reloadSkips()
  })
  const { oneRms } = useRecords(canLog ? me : undefined)
  // "L" badge: leaders of the program's weekly leaderboard, refreshed with the scores.
  const leaders = useWeekLeaders(loaded ? programId : null, workout.date, results)
  // Claps on others' scores: only with the program's claps setting on.
  const clapsOn = settings?.claps ?? false
  const { claps, clap, unclap } = useClaps(clapsOn ? workout.id : undefined, me, results)

  return (
    <>
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
            me={me}
            canLog={canLog}
            skipped={skips?.has(block.id) ?? false}
            showBoard={boardOn || !canLog}
            leaders={leaders}
            claps={clapsOn ? claps : undefined}
            onClap={clap}
            onUnclap={unclap}
            onChange={() => {
              reload()
              reloadSkips()
            }}
          />
        )}
      />
      {canLog && me && loaded && <SaveAsRecord workout={workout} results={results} me={me} />}
    </>
  )
}
