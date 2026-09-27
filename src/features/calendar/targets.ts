import type { Assignment } from '../../lib/supabase'

export const isEveryone = (a: Assignment) => a.program_id === null && a.athlete_id === null
