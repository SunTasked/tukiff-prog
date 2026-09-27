import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { AthletesPage } from './features/athletes/AthletesPage'
import { MemberPage } from './features/athletes/MemberPage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { ScheduledWorkoutPage } from './features/calendar/ScheduledWorkoutPage'
import { AthleteWorkoutPage } from './features/home/AthleteWorkoutPage'
import { ProgramPage } from './features/programs/ProgramPage'
import { hasPassword, isCoach, useAuth } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { OnboardingPage } from './features/auth/OnboardingPage'
import { PendingPage } from './features/auth/PendingPage'
import { ResetPasswordPage } from './features/auth/ResetPasswordPage'
import { ExerciseFormPage } from './features/exercises/ExerciseFormPage'
import { HomePage } from './features/home/HomePage'
import { LibraryPage } from './features/library/LibraryPage'
import { WorkoutEditor } from './features/workouts/WorkoutEditor'
import { WorkoutPage } from './features/workouts/WorkoutPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { RecordsPage } from './features/records/RecordsPage'
import { TimerPage } from './features/timer/TimerPage'
import { getItem, setItem } from './lib/storage'
import { supabase } from './lib/supabase'

const INVITE_KEY = 'pendingInvite'

/** Reading-width column on desktop (the layout itself is wide for planning / library). */
const narrow = (el: ReactNode) => <div className="lg:mx-auto lg:max-w-3xl">{el}</div>

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
  if (!session) return <LoginPage inviteCode={pendingInvite} />
  if (pendingInvite) return <Spinner />
  if (location.pathname === '/reset-password') return <ResetPasswordPage onDone={() => navigate('/', { replace: true })} />
  if (!profile?.role) return <PendingPage error={inviteError} />
  if (!profile.display_name || !hasPassword(session)) return <OnboardingPage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={narrow(<HomePage />)} />
        <Route path="profile" element={narrow(<ProfilePage />)} />
        <Route path="workouts/:id" element={narrow(<AthleteWorkoutPage />)} />
        <Route path="records" element={narrow(<RecordsPage />)} />
        <Route path="timer" element={narrow(<TimerPage />)} />
        {isCoach(profile) && (
          <>
            <Route path="athletes" element={<AthletesPage />} />
            <Route path="athletes/:id" element={narrow(<MemberPage />)} />
            <Route path="programs/:id" element={narrow(<ProgramPage />)} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="calendar/workouts/:id" element={narrow(<ScheduledWorkoutPage />)} />
            <Route path="library" element={<LibraryPage />}>
              <Route path="workouts/new" element={<WorkoutEditor />} />
              <Route path="workouts/:id" element={<WorkoutPage />} />
              <Route path="workouts/:id/edit" element={<WorkoutEditor />} />
              <Route path="exercises/new" element={<ExerciseFormPage />} />
              <Route path="exercises/:id" element={<ExerciseFormPage />} />
            </Route>
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
