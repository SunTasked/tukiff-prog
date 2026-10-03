import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { PageTitle } from '../../components/ui'
import { MEASURES, type Measure } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
import { searchExercises, useExercises } from '../exercises/useExercises'
import { SectionedList, type Section } from './SectionedList'

/**
 * Categories shown first, in this order: movement benchmarks (records of the movement, box leaderboard; exercises.benchmark_category)
 * then the library sections "Ergo / <machine>" (a library section "Parent / Child" is a sub-section of Parent).
 */
const PINNED = ['Force', 'Haltéro', 'Gym suspendue', 'Ergo']

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
      <PageTitle>PR</PageTitle>
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

type ListItem = { id: string; name: string; section_id: string | null; sub?: string; to: string }

function WorkoutList() {
  const { pathname } = useLocation()
  const [rows, setRows] = useState<ListItem[] | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [scored, setScored] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const [w, s, r, m, ms] = await Promise.all([
      supabase.from('workouts').select('id, title, section_id').is('date', null),
      supabase.from('library_sections').select('id, name'),
      supabase.rpc('benchmarks_scored'),
      supabase.from('exercises').select('id, name, benchmark_category').not('benchmark_category', 'is', null),
      supabase.rpc('exercises_scored'),
    ])
    // A section "Parent / Child" is shown as the sub-section Child of Parent; categories without a library section
    // (movement categories, parents of sub-sections) get their name as id.
    const library = s.data ?? []
    const parentOf = new Map(library.map((l) => [l.id, l.name.split(' / ')]))
    setRows([
      ...(w.data ?? []).map((t) => {
        const [parent, sub] = (t.section_id && parentOf.get(t.section_id)) || []
        const section_id = sub ? parent : t.section_id
        return { id: t.id, name: t.title, section_id, sub, to: `/library/workouts/${t.id}` }
      }),
      ...(m.data ?? []).map((e) => ({ id: e.id, name: e.name, section_id: e.benchmark_category, to: `/library/movements/${e.id}` })),
    ])
    const top = library.filter((l) => !l.name.includes(' / '))
    const virtual = [...new Set([...(m.data ?? []).map((e) => e.benchmark_category!), ...library.flatMap((l) => (l.name.includes(' / ') ? [l.name.split(' / ')[0]] : []))])]
    setSections([...top, ...virtual.filter((n) => !top.some((l) => l.name === n)).map((n) => ({ id: n, name: n }))])
    setScored(new Set([...(r.data ?? []), ...(ms.data ?? [])]))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = searchExercises(rows ?? [], query)
  const pinned = PINNED.flatMap((n) => sections.filter((s) => s.name === n))
  const others = sections.filter((s) => !pinned.includes(s))
  const inPinned = (item: ListItem) => pinned.some((s) => s.id === item.section_id)
  const renderItem = (item: ListItem) => (
    <Link to={item.to} className={itemClass(pathname.startsWith(item.to))}>
      <span className="truncate">{item.name}</span>
      {scored.has(item.id) && <Podium />}
    </Link>
  )

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
        items={filtered.filter(inPinned)}
        sections={pinned}
        query={query}
        storageKey="librarySectionsExpanded"
        ordered
        subOf={(i) => i.sub}
        renderItem={renderItem}
      />
      <SectionedList
        items={filtered.filter((i) => !inPinned(i))}
        sections={others}
        query={query}
        storageKey="librarySectionsExpanded"
        subOf={(i) => i.sub}
        renderItem={renderItem}
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
  const [query, setQuery] = useState('')
  const [scored, setScored] = useState<Set<string> | null>(null)
  const [onlyScored, setOnlyScored] = useState(true)
  useEffect(() => {
    supabase.rpc('exercises_scored').then(({ data }) => setScored(new Set(data ?? [])))
  }, [pathname])
  const shown = onlyScored && scored ? exercises.filter((e) => scored.has(e.id)) : exercises
  const results = searchExercises(shown, query)

  return (
    <div className="flex flex-col gap-3">
      <input
        placeholder={`Rechercher parmi ${shown.length} exercices`}
        className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-lime-400"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button
        role="switch"
        aria-checked={onlyScored}
        className="flex items-center justify-between gap-2 text-sm text-zinc-400"
        onClick={() => setOnlyScored((on) => !on)}
      >
        Masquer les mouvements sans PR
        <span className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${onlyScored ? 'bg-lime-400' : 'bg-zinc-700'}`}>
          <span className={`size-4 rounded-full bg-zinc-950 transition-transform ${onlyScored ? 'translate-x-4' : ''}`} />
        </span>
      </button>
      <SectionedList
        items={results}
        sections={sections}
        query={query}
        storageKey="exerciseSectionsExpanded"
        hideEmpty={onlyScored}
        renderItem={(e) => (
          <Link to={`/library/exercises/${e.id}`} className={itemClass(pathname === `/library/exercises/${e.id}`)}>
            <span className="truncate">{e.name}</span>
            <span className="flex shrink-0 items-center gap-2 text-sm text-zinc-500">
              {MEASURES[e.measure as Measure]}
              {e.video_url ? ' · ▶' : ''}
            </span>
          </Link>
        )}
      />
    </div>
  )
}

/** At least one record on this benchmark (anyone's): its leaderboard has rows. */
function Podium() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-label="Classement">
      <path d="M9 21V8h6v13M3 21v-8h6M15 21v-5h6v5zM2 21h20" />
    </svg>
  )
}
