import { useCallback, useEffect, useState } from 'react'
import { useOnResume } from '../../lib/resume'
import { supabase } from '../../lib/supabase'
import type { Person } from './PeopleSheet'

export type Claps = {
  /** Claps per score (result id). */
  counts: Map<string, number>
  /** Scores I clapped. */
  given: Set<string>
  /** Who clapped, per result id (every score I can read). */
  by: Map<string, Person[]>
}

const empty = (): Claps => ({ counts: new Map(), given: new Set(), by: new Map() })

/** Claps of a workout: counts and authors, on the scores I can read (RLS). */
export function useClaps(workoutId: string | undefined, me: string | undefined, version: unknown) {
  const [claps, setClaps] = useState<Claps>(empty)
  const reload = useCallback(async () => {
    if (!workoutId) return
    const [counts, rows] = await Promise.all([
      supabase.rpc('clap_counts', { p_workout: workoutId }),
      supabase.from('result_claps').select('result_id, from_user').eq('workout_id', workoutId),
    ])
    const next = empty()
    for (const c of counts.data ?? []) next.counts.set(c.result_id, c.claps)
    // from_user references auth.users (see migration 0047): names come from profiles separately.
    const ids = [...new Set((rows.data ?? []).map((r) => r.from_user))]
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id, display_name, first_name, last_name, avatar_url').in('id', ids)
      : { data: [] }
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]))
    for (const r of rows.data ?? []) if (r.from_user === me) next.given.add(r.result_id)
    for (const r of rows.data ?? [])
      next.by.set(r.result_id, [...(next.by.get(r.result_id) ?? []), { id: r.from_user, profiles: byId.get(r.from_user) ?? null }])
    setClaps(next)
  }, [workoutId, me])
  useEffect(() => {
    reload()
  }, [reload, version])
  useOnResume(reload)

  async function clap(resultId: string) {
    // Optimistic; a failure (own score, leaderboard off) just reloads.
    setClaps((c) => ({
      ...c,
      given: new Set([...c.given, resultId]),
      counts: new Map(c.counts).set(resultId, (c.counts.get(resultId) ?? 0) + 1),
    }))
    const { error } = await supabase.from('result_claps').insert({ result_id: resultId, workout_id: workoutId! })
    if (error) reload()
  }

  async function unclap(resultId: string) {
    setClaps((c) => {
      const given = new Set(c.given)
      given.delete(resultId)
      return { ...c, given, counts: new Map(c.counts).set(resultId, Math.max(0, (c.counts.get(resultId) ?? 1) - 1)) }
    })
    const { error } = await supabase.from('result_claps').delete().eq('result_id', resultId).eq('from_user', me!)
    if (error) reload()
  }

  return { claps, clap, unclap }
}
