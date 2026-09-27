import { useCallback, useEffect, useState } from 'react'
import { supabase, type Profile, type Program } from '../../lib/supabase'

/** Active programs and members (coach screens). */
export function useTeam() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [members, setMembers] = useState<Profile[]>([])

  const reload = useCallback(async () => {
    const [p, m] = await Promise.all([
      supabase.from('programs').select('*').is('archived_at', null).order('name'),
      supabase.from('profiles').select('*').not('role', 'is', null).order('display_name'),
    ])
    setPrograms(p.data ?? [])
    setMembers(m.data ?? [])
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { programs, members, reload }
}
