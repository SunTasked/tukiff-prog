import { useCallback, useEffect, useState } from 'react'
import { asPrefs, notificationOn } from '../domain/notifications'
import { useOnResume } from './resume'
import { supabase, type Profile } from './supabase'

/** Members who clapped my scores since claps_seen_at; 0 when claps notifications are off. */
export async function newClappers(p: Profile | null) {
  if (!p || !notificationOn(asPrefs(p.notifications), 'claps')) return 0
  const { data } = await supabase.rpc('new_clappers', undefined, { get: true })
  return data ?? 0
}

/** Members who clapped my scores since I last opened Messages (profiles.claps_seen_at); 0 when claps notifications are off. */
export function useNewClappers(p: Profile | null) {
  const [count, setCount] = useState(0)
  const load = useCallback(async () => setCount(await newClappers(p)), [p])
  useEffect(() => {
    void load()
  }, [load])
  useOnResume(load)
  return count
}

/** Nothing else is stored: the notification goes away once the claps are read. */
export async function markClapsRead(p: Profile | null) {
  if (!p) return false
  const { error } = await supabase.from('profiles').update({ claps_seen_at: new Date().toISOString() }).eq('id', p.id)
  return !error
}
