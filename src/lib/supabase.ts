import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Writes in flight (anything but GET: inserts, updates, RPCs): the app shows a blocking throbber while they last.
let pendingWrites = 0
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export const pendingRequests = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  count: () => pendingWrites,
}

const trackedFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const url = input instanceof Request ? input.url : String(input)
  // Reads and background usage counters never block the screen.
  if (method === 'GET' || method === 'HEAD' || url.includes('/rpc/track_usage')) return fetch(input, init)
  pendingWrites++
  notify()
  try {
    return await fetch(input, init)
  } finally {
    pendingWrites--
    notify()
  }
}

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { global: { fetch: trackedFetch } },
)

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Invitation = Database['public']['Tables']['invitations']['Row']
export type Exercise = Database['public']['Tables']['exercises']['Row']
export type Program = Database['public']['Tables']['programs']['Row']
export type Result = Database['public']['Tables']['results']['Row']
export type PersonalRecord = Database['public']['Tables']['personal_records']['Row']
