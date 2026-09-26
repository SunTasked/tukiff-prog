import { NavLink, Outlet } from 'react-router'
import { isCoach, useAuth } from '../features/auth/AuthProvider'

type Tab = { to: string; label: string; icon: string; coachOnly?: boolean }

// Coaches are athletes too: they get the athlete tabs plus coach tabs.
const tabs: Tab[] = [
  { to: '/', label: 'Accueil', icon: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z' },
  {
    to: '/athletes',
    label: 'Athlètes',
    coachOnly: true,
    icon: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0',
  },
  { to: '/profile', label: 'Profil', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0' },
]

export function Layout() {
  const { profile } = useAuth()
  const visible = tabs.filter((t) => !t.coachOnly || isCoach(profile))

  return (
    <div className="mx-auto min-h-dvh max-w-md pt-[env(safe-area-inset-top)]">
      <main className="px-4 pt-4 pb-28">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto flex max-w-md">
          {visible.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2 text-xs ${isActive ? 'text-lime-400' : 'text-zinc-500'}`
                }
              >
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={t.icon} />
                </svg>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
