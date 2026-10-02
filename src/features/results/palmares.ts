import { useEffect, useMemo, useState } from 'react'
import { onResume } from '../../lib/resume'
import { supabase } from '../../lib/supabase'

/** Weeks as leader of a weekly leaderboard, blocks won (null: hidden from me) and crown of the week (3 blocks won last week). */
export type Palmares = { leader_weeks: number | null; wins: number | null; crown: boolean }
type ById = Map<string, Palmares>

// Computed by the database from the closed weeks: loaded once, reloaded when the app comes back.
let cache: Promise<ById> | null = null
const listeners = new Set<(p: ById) => void>()

function load(): Promise<ById> {
  if (!cache) {
    const fresh = fetchPalmares()
    fresh.then((p) => listeners.forEach((l) => l(p)))
    cache = fresh
  }
  return cache
}

async function fetchPalmares(): Promise<ById> {
  const { data } = await supabase.rpc('palmares', undefined, { get: true })
  return new Map((data ?? []).map(({ athlete_id, ...p }) => [athlete_id, p]))
}

onResume(() => {
  cache = null
  if (listeners.size) load()
})

/** Palmarès of every athlete who has one (absent: nothing yet). */
export function usePalmares(): ById {
  const [byId, setById] = useState<ById>(new Map())
  useEffect(() => {
    listeners.add(setById)
    load().then(setById)
    return () => void listeners.delete(setById)
  }, [])
  return byId
}

/** Athletes who wear the crown this week. */
export function useCrowns(): Set<string> {
  const byId = usePalmares()
  return useMemo(() => new Set([...byId].filter(([, p]) => p.crown).map(([id]) => id)), [byId])
}
