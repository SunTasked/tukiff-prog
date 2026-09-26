import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { AthletesPage } from './features/athletes/AthletesPage'
import { isCoach, useAuth } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { OnboardingPage } from './features/auth/OnboardingPage'
import { PendingPage } from './features/auth/PendingPage'
import { HomePage } from './features/home/HomePage'
import { ProfilePage } from './features/profile/ProfilePage'
import { getItem, setItem } from './lib/storage'
import { supabase } from './lib/supabase'

const INVITE_KEY = 'pendingInvite'

export default function App() {
  const { session, profile, loading, refreshProfile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [inviteError, setInviteError] = useState('')

  // /join/:code stores the code until the user is signed in.
  const joinMatch = location.pathname.match(/^\/join\/([\w-]+)/)
  useEffect(() => {
    if (joinMatch) setItem(INVITE_KEY, joinMatch[1])
  }, [joinMatch?.[1]])

  const pendingInvite = joinMatch?.[1] ?? getItem(INVITE_KEY)

  useEffect(() => {
    if (!session || !pendingInvite) return
    supabase.rpc('accept_invitation', { p_code: pendingInvite }).then(async ({ error }) => {
      setItem(INVITE_KEY, null)
      setInviteError(error ? 'Lien d’invitation invalide, expiré ou déjà utilisé.' : '')
      await refreshProfile()
      navigate('/', { replace: true })
    })
  }, [session, pendingInvite])

  if (loading) return <Spinner />
  if (!session) return <LoginPage invited={!!pendingInvite} />
  if (pendingInvite) return <Spinner />
  if (!profile?.role) return <PendingPage error={inviteError} />
  if (!profile.display_name) return <OnboardingPage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="profile" element={<ProfilePage />} />
        {isCoach(profile) && <Route path="athletes" element={<AthletesPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
