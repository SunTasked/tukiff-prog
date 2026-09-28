import { useCallback, useEffect, useState } from 'react'
import type { Gender } from '../../domain/profile'
import { useOnResume } from '../../lib/resume'
import { supabase, type Result } from '../../lib/supabase'

export type ResultRow = Result & {
  profiles: { display_name: string | null; gender: Gender | null; avatar_url: string | null } | null
}

/** Results of a workout visible to the current user (RLS: own, shared, or all for coaches). */
export function useWorkoutResults(workoutId: string | undefined) {
  const [results, setResults] = useState<ResultRow[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    if (!workoutId) return
    const { data } = await supabase.from('results').select('*, profiles(display_name, gender, avatar_url)').eq('workout_id', workoutId)
    setResults((data ?? []) as ResultRow[])
    setLoaded(true)
  }, [workoutId])

  useEffect(() => {
    reload()
  }, [reload])
  // Other athletes' scores come in while the app sits in the background.
  useOnResume(reload)

  return { results, loaded, reload }
}
