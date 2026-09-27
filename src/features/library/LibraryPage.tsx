import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { PageTitle } from '../../components/ui'
import { MEASURES, type Measure } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
import { searchExercises, useExercises } from '../exercises/useExercises'

type WorkoutRow = { id: string; title: string; updated_at: string }
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/**
 * Library layout. Mobile: list, or the selected item. Desktop: list and detail side by side;
 * editors (new / edit) take the full width.
 */
export function LibraryPage() {
  const { pathname } = useLocation()
  const child = pathname.replace(/\/$/, '') !== '/library'
  if (/\/(new|edit)$/.test(pathname)) return <Outlet />

  return (
    <div className="lg:grid lg:grid-cols-[22rem_1fr] lg:items-start lg:gap-8">
      <div className={child ? 'hidden lg:block' : ''}>
        <LibraryList />
      </div>
      <div className={child ? '' : 'hidden lg:block'}>
        {child ? (
          <Outlet />
        ) : (
          <p className="mt-24 text-center text-zinc-500">Sélectionne une séance ou un exercice.</p>
        )}
      </div>
    </div>
  )
}

function LibraryList() {
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const tab = pathname.startsWith('/library/exercises') || params.get('tab') === 'exercises' ? 'exercises' : 'workouts'

  return (
    <>
      <PageTitle>Bibliothèque</PageTitle>
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-zinc-900 p-1 text-sm">
        {(['workouts', 'exercises'] as const).map((t) => (
          <button
            key={t}
            className={`rounded-lg py-2 font-semibold ${tab === t ? 'bg-zinc-800 text-lime-400' : 'text-zinc-400'}`}
            onClick={() => navigate(t === 'exercises' ? '/library?tab=exercises' : '/library', { replace: true })}
          >
            {t === 'workouts' ? 'Séances' : 'Exercices'}
          </button>
        ))}
      </div>
      {tab === 'workouts' ? <WorkoutList /> : <ExerciseList />}
    </>
  )
}

const itemClass = (active: boolean) => `flex justify-between px-4 py-3 ${active ? 'bg-zinc-800 text-lime-400' : ''}`

function WorkoutList() {
  const { pathname } = useLocation()
  const [rows, setRows] = useState<WorkoutRow[] | null>(null)
  // Reload when the detail pane changes (after a save or delete).
  useEffect(() => {
    supabase
      .from('workouts')
      .select('id, title, updated_at')
      .is('date', null)
      .order('updated_at', { ascending: false })
      .then(({ data }) => setRows(data ?? []))
  }, [pathname])

  return (
    <div className="flex flex-col gap-3">
      <Link to="/library/workouts/new" className="rounded-xl bg-lime-400 py-3 text-center font-semibold text-zinc-950">
        + Nouvelle séance
      </Link>
      {rows?.length === 0 && <p className="text-zinc-400">Aucune séance pour l’instant.</p>}
      <ul className="divide-y divide-zinc-800 rounded-2xl bg-zinc-900">
        {rows?.map((w) => (
          <li key={w.id}>
            <Link to={`/library/workouts/${w.id}`} className={itemClass(pathname.startsWith(`/library/workouts/${w.id}`))}>
              <span className="truncate">{w.title}</span>
              <span className="shrink-0 text-sm text-zinc-500">{dateFmt.format(new Date(w.updated_at))}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ExerciseList() {
  const { pathname } = useLocation()
  const { exercises, reload } = useExercises()
  useEffect(() => {
    reload()
  }, [pathname, reload])
  const [query, setQuery] = useState('')
  const results = searchExercises(exercises, query)

  return (
    <div className="flex flex-col gap-3">
      <Link
        to="/library/exercises/new"
        className="rounded-xl bg-lime-400 py-3 text-center font-semibold text-zinc-950"
      >
        + Nouvel exercice
      </Link>
      <input
        placeholder={`Rechercher parmi ${exercises.length} exercices`}
        className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-lime-400"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="divide-y divide-zinc-800 rounded-2xl bg-zinc-900">
        {results.map((e) => (
          <li key={e.id}>
            <Link to={`/library/exercises/${e.id}`} className={itemClass(pathname === `/library/exercises/${e.id}`)}>
              <span className="truncate">{e.name}</span>
              <span className="shrink-0 text-sm text-zinc-500">
                {MEASURES[e.measure as Measure]}
                {e.video_url ? ' · ▶' : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
