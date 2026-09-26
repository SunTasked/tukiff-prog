import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, type Profile } from '../../lib/supabase'

type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const userId = session?.user.id

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setProfileLoaded(true)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data)
    setProfileLoaded(true)
  }, [userId])

  useEffect(() => {
    setProfileLoaded(false)
    refreshProfile()
  }, [refreshProfile])

  const loading = !sessionLoaded || !profileLoaded
  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export const isCoach = (p: Profile | null) => p?.role === 'coach'
