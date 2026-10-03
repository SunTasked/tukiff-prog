import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Writes in flight (anything but GET: inserts, updates, RPCs): the app shows a blocking throbber while they last.
// Read-only RPCs are reads: they load screens (and off-screen neighbour days), they must not block taps or swipes.
const READ_RPCS = /\/rpc\/(admin_usage|benchmark_board|benchmarks_scored|clap_counts|exercise_board|exercises_scored|locked_blocks|member_email|members_last_seen|my_workouts|new_clappers|team_candidates)\b/
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
  const write = method !== 'GET' && method !== 'HEAD' && !READ_RPCS.test(url)
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
export type ClapCompliment = Database['public']['Tables']['clap_compliments']['Row']
export type PersonalRecord = Database['public']['Tables']['personal_records']['Row']
