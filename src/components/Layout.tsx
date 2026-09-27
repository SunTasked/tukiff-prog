import { NavLink, Outlet } from 'react-router'
import { isAdmin, isCoach, useAuth } from '../features/auth/AuthProvider'
import { InstallBanner } from './InstallBanner'

type Tab = { to: string; label: string; icon: string; coachOnly?: boolean; longLabel?: string }

// Coaches are athletes too: they get the athlete tabs plus coach tabs.
const tabs: Tab[] = [
  { to: '/', label: 'Accueil', icon: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z' },
  {
    to: '/calendar',
    label: 'Planning',
    longLabel: 'Programmation',
    coachOnly: true,
    icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  },
  {
    to: '/library',
    label: 'Biblio',
    longLabel: 'Bibliothèque',
    coachOnly: true,
    icon: 'M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13M8 7h7',
  },
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
  const visible = tabs
    .filter((t) => !t.coachOnly || isCoach(profile))
    .map((t) => (t.to === '/athletes' && isAdmin(profile) ? { ...t, label: 'Membres', longLabel: 'Membres' } : t))

  const icon = (t: Tab) => (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={t.icon} />
    </svg>
  )

  // Mobile: bottom tab bar. Desktop (lg): left sidebar and a wide content area.
  return (
    <div className="min-h-dvh pt-[env(safe-area-inset-top)] lg:pl-56">
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col gap-1 border-r border-zinc-800 bg-zinc-950 p-4 lg:flex">
        <img src="/tkf-logo.jpg" alt="TKF Programming" className="mb-6 w-40 mix-blend-screen" />
        {visible.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold ${
                isActive ? 'bg-zinc-900 text-lime-400' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
              }`
            }
          >
            {icon(t)}
            {t.longLabel ?? t.label}
          </NavLink>
        ))}
      </aside>

      <main className="mx-auto max-w-md px-4 pt-4 pb-28 lg:max-w-7xl lg:px-8 lg:pt-8 lg:pb-12">
        <InstallBanner />
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
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
                {icon(t)}
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
