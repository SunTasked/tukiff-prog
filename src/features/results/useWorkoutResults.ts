import { useCallback, useEffect, useState } from 'react'
import { supabase, type Result } from '../../lib/supabase'

export type ResultRow = Result & { profiles: { display_name: string | null } | null }

/** Results of a workout visible to the current user (RLS: own, shared, or all for coaches). */
export function useWorkoutResults(workoutId: string | undefined) {
  const [results, setResults] = useState<ResultRow[]>([])

  const reload = useCallback(async () => {
    if (!workoutId) return
    const { data } = await supabase.from('results').select('*, profiles(display_name)').eq('workout_id', workoutId)
    setResults((data ?? []) as ResultRow[])
  }, [workoutId])

  useEffect(() => {
    reload()
  }, [reload])

  return { results, reload }
}
