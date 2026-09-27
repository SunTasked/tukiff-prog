import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Invitation = Database['public']['Tables']['invitations']['Row']
export type Exercise = Database['public']['Tables']['exercises']['Row']
export type Program = Database['public']['Tables']['programs']['Row']
export type Assignment = { program_id: string | null; athlete_id: string | null }
export type Result = Database['public']['Tables']['results']['Row']
export type PersonalRecord = Database['public']['Tables']['personal_records']['Row']
