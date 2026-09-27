import { useCallback, useEffect, useState } from 'react'
import { supabase, type Program } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

export type EditableProgram = Program & { program_coaches: { coach_id: string }[]; isOwner: boolean }

/** Active programs the current coach owns or contributes to (the only ones shown in coach screens). */
export function useMyPrograms() {
  const { session } = useAuth()
  const me = session?.user.id
  const [programs, setPrograms] = useState<EditableProgram[] | null>(null)

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('programs')
      .select('*, program_coaches(coach_id)')
      .is('archived_at', null)
      .order('name')
    setPrograms(
      (data ?? [])
        .filter((p) => p.owner_id === me || p.program_coaches.some((c) => c.coach_id === me))
        .map((p) => ({ ...p, isOwner: p.owner_id === me })),
    )
  }, [me])

  useEffect(() => {
    reload()
  }, [reload])

  return { programs, reload }
}
