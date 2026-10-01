import { useEffect, useState } from 'react'
import { supabase, type Sponsor } from './supabase'

// A handful of rows, read by every block: loaded once, shared by all components.
let cache: Sponsor[] | null = null
let pending: Promise<Sponsor[]> | null = null
const listeners = new Set<(list: Sponsor[]) => void>()

async function fetchSponsors() {
  const { data } = await supabase.from('sponsors').select('*').order('name')
  cache = data ?? []
  listeners.forEach((l) => l(cache!))
  return cache
}

/** Reloads the list (after an admin change) for every mounted component. */
export const reloadSponsors = () => (pending = fetchSponsors())

/** All sponsors, archived included (past blocks keep theirs). */
export function useSponsors() {
  const [list, setList] = useState<Sponsor[]>(cache ?? [])
  useEffect(() => {
    listeners.add(setList)
    if (!cache) (pending ??= fetchSponsors()).then(setList)
    return () => void listeners.delete(setList)
  }, [])
  return list
}

/** Uploads the cropped logo (PNG from LogoCropper); returns its versioned URL (so caches refresh). */
export async function uploadLogo(sponsorId: string, blob: Blob): Promise<{ url?: string; error?: string }> {
  const path = `${sponsorId}.png`
  const { error } = await supabase.storage.from('sponsors').upload(path, blob, {
    upsert: true,
    contentType: 'image/png',
    cacheControl: '31536000',
  })
  if (error) return { error: error.message }
  return { url: `${supabase.storage.from('sponsors').getPublicUrl(path).data.publicUrl}?v=${Date.now()}` }
}
