import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, type Profile } from '../../lib/supabase'

type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  refreshSession: () => Promise<void>
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

  const refreshSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
  }, [])

  const loading = !sessionLoaded || !profileLoaded
  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, refreshSession }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export const isCoach = (p: Profile | null) => p?.role === 'coach'
export const isAdmin = (p: Profile | null) => p?.is_admin === true

export const roleLabel = (p: Pick<Profile, 'role' | 'is_admin'> | null) =>
  p?.is_admin ? 'Admin' : p?.role === 'coach' ? 'Coach' : 'Athlète'

/** UI flag set when the user chose a password (onboarding / reset); not a security check. */
export const hasPassword = (s: Session | null) => s?.user.user_metadata?.password_set === true
