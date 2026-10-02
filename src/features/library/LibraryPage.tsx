import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { PageTitle } from '../../components/ui'
import { MEASURES, type Measure } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
import { isCoach, useAuth } from '../auth/AuthProvider'
import { searchExercises, useExercises } from '../exercises/useExercises'
import { SectionedList, useSectionActions, type Section } from './SectionedList'

type WorkoutRow = { id: string; title: string; section_id: string | null }

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
          <p className="mt-24 text-center text-zinc-500">Sélectionne un benchmark ou un exercice.</p>
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
            {t === 'workouts' ? 'Benchmarks' : 'Exercices'}
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
  const [sections, setSections] = useState<Section[]>([])
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const [w, s] = await Promise.all([
      supabase.from('workouts').select('id, title, section_id').is('date', null),
      supabase.from('library_sections').select('id, name'),
    ])
    setRows(w.data ?? [])
    setSections(s.data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = searchExercises((rows ?? []).map((r) => ({ ...r, name: r.title })), query)

  return (
    <div className="flex flex-col gap-3">
      <input
        placeholder="Rechercher un benchmark"
        className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-lime-400"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {rows?.length === 0 && <p className="text-zinc-400">Aucun benchmark pour l’instant.</p>}
      <SectionedList
        items={filtered}
        sections={sections}
        query={query}
        storageKey="librarySectionsExpanded"
        what="benchmarks"
        renderItem={(w) => (
          <Link to={`/library/workouts/${w.id}`} className={itemClass(pathname.startsWith(`/library/workouts/${w.id}`))}>
            <span className="truncate">{w.title}</span>
          </Link>
        )}
      />
    </div>
  )
}

function ExerciseList() {
  const { pathname } = useLocation()
  const coach = isCoach(useAuth().profile)
  const { exercises, sections, reload } = useExercises()
  useEffect(() => {
    reload()
  }, [pathname, reload])
  const actions = useSectionActions('exercise_sections', reload)
  const [query, setQuery] = useState('')
  const results = searchExercises(exercises, query)

  return (
    <div className="flex flex-col gap-3">
      {coach && (
        <div className="flex gap-2">
          <Link to="/library/exercises/new" className="flex-1 rounded-xl bg-lime-400 py-3 text-center font-semibold text-zinc-950">
            + Nouvel exercice
          </Link>
          <button className="rounded-xl bg-zinc-800 px-4 font-semibold" onClick={() => actions.create('Ergos, Gymnastique, Haltéro')}>
            + Section
          </button>
        </div>
      )}
      <input
        placeholder={`Rechercher parmi ${exercises.length} exercices`}
        className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-lime-400"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <SectionedList
        items={results}
        sections={sections}
        query={query}
        storageKey="exerciseSectionsExpanded"
        actions={coach ? actions : undefined}
        what="exercices"
        newHref={(s) => `/library/exercises/new?section=${s.id}`}
        renderItem={(e) => (
          <Link to={`/library/exercises/${e.id}`} className={itemClass(pathname === `/library/exercises/${e.id}`)}>
            <span className="truncate">{e.name}</span>
            <span className="shrink-0 text-sm text-zinc-500">
              {MEASURES[e.measure as Measure]}
              {e.video_url ? ' · ▶' : ''}
            </span>
          </Link>
        )}
      />
    </div>
  )
}
