import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { PageTitle } from '../../components/ui'
import { MEASURES, type Measure } from '../../domain/workout'
import { isCoach, useAuth } from '../auth/AuthProvider'
import { supabase } from '../../lib/supabase'
import { searchExercises, useExercises } from '../exercises/useExercises'
import { SectionedList, useSectionActions, type Section } from './SectionedList'

type WorkoutRow = { id: string; title: string; updated_at: string; section_id: string | null }
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/**
 * Library layout. Mobile: list, or the selected item. Desktop: list and detail side by side;
 * editors (new / edit) take the full width.
 */
export function LibraryPage() {
  const { pathname } = useLocation()
  const child = pathname.replace(/\/$/, '') !== '/library'
  const coach = isCoach(useAuth().profile)
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
          <p className="mt-24 text-center text-zinc-500">Sélectionne une séance{coach ? ' ou un exercice' : ''}.</p>
        )}
      </div>
    </div>
  )
}

function LibraryList() {
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const coach = isCoach(useAuth().profile)
  const tab = coach && (pathname.startsWith('/library/exercises') || params.get('tab') === 'exercises') ? 'exercises' : 'workouts'

  // Athletes: sessions only, read-only.
  if (!coach)
    return (
      <>
        <PageTitle>Bibliothèque</PageTitle>
        <WorkoutList readOnly />
      </>
    )

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

function WorkoutList({ readOnly = false }: { readOnly?: boolean }) {
  const { pathname } = useLocation()
  const [rows, setRows] = useState<WorkoutRow[] | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const [w, s] = await Promise.all([
      supabase.from('workouts').select('id, title, updated_at, section_id').is('date', null),
      supabase.from('library_sections').select('id, name'),
    ])
    setRows(w.data ?? [])
    setSections(s.data ?? [])
  }, [])
  const actions = useSectionActions('library_sections', load)

  // Reload when the detail pane changes (after a save or delete).
  useEffect(() => {
    load()
  }, [load, pathname])

  const filtered = searchExercises((rows ?? []).map((r) => ({ ...r, name: r.title })), query)

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && (
        <div className="flex gap-2">
          <Link to="/library/workouts/new" className="flex-1 rounded-xl bg-lime-400 py-3 text-center font-semibold text-zinc-950">
            + Nouvelle séance
          </Link>
          <button className="rounded-xl bg-zinc-800 px-4 font-semibold" onClick={() => actions.create('Benchmark CrossFit, Hyrox, Haltéro')}>
            + Section
          </button>
        </div>
      )}
      <input
        placeholder="Rechercher une séance"
        className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-lime-400"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {rows?.length === 0 && <p className="text-zinc-400">Aucune séance pour l’instant.</p>}
      <SectionedList
        items={filtered}
        sections={sections}
        query={query}
        storageKey="librarySectionsExpanded"
        actions={readOnly ? undefined : actions}
        what="séances"
        newHref={readOnly ? undefined : (s) => `/library/workouts/new?section=${s.id}`}
        renderItem={(w) => (
          <Link to={`/library/workouts/${w.id}`} className={itemClass(pathname.startsWith(`/library/workouts/${w.id}`))}>
            <span className="truncate">{w.title}</span>
            <span className="shrink-0 text-sm text-zinc-500">{dateFmt.format(new Date(w.updated_at))}</span>
          </Link>
        )}
      />
    </div>
  )
}

function ExerciseList() {
  const { pathname } = useLocation()
  const { exercises, sections, reload } = useExercises()
  useEffect(() => {
    reload()
  }, [pathname, reload])
  const actions = useSectionActions('exercise_sections', reload)
  const [query, setQuery] = useState('')
  const results = searchExercises(exercises, query)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Link to="/library/exercises/new" className="flex-1 rounded-xl bg-lime-400 py-3 text-center font-semibold text-zinc-950">
          + Nouvel exercice
        </Link>
        <button className="rounded-xl bg-zinc-800 px-4 font-semibold" onClick={() => actions.create('Ergos, Gymnastique, Haltéro')}>
          + Section
        </button>
      </div>
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
        actions={actions}
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
