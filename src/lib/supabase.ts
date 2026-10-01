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

/** All requests in flight (except usage counters), used to time how long a screen takes to load its data. */
export const network = { inFlight: 0, lastEnd: 0 }

const trackedFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const url = input instanceof Request ? input.url : String(input)
  if (url.includes('/rpc/track_usage')) return fetch(input, init)
  // Reads never block the screen.
  const write = method !== 'GET' && method !== 'HEAD'
  network.inFlight++
  if (write) {
    pendingWrites++
    notify()
  }
  try {
    return await fetch(input, init)
  } finally {
    network.inFlight--
    network.lastEnd = performance.now()
    if (write) {
      pendingWrites--
      notify()
    }
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
export type Sponsor = Database['public']['Tables']['sponsors']['Row']
export type PersonalRecord = Database['public']['Tables']['personal_records']['Row']
