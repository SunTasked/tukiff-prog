import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { ErrorText, PageTitle } from '../../components/ui'
import { groupBySection } from '../../domain/sections'
import { getItem, setItem } from '../../lib/storage'
import { MEASURES, type Measure } from '../../domain/workout'
import { supabase } from '../../lib/supabase'
import { searchExercises, useExercises } from '../exercises/useExercises'

type WorkoutRow = { id: string; title: string; updated_at: string; section_id: string | null }
type Section = { id: string; name: string }
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

/** Library templates grouped in collapsible sections (collapsed state remembered on the device). */
function WorkoutList() {
  const { pathname } = useLocation()
  const [rows, setRows] = useState<WorkoutRow[] | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    try {
      return JSON.parse(getItem('librarySectionsCollapsed') ?? '[]')
    } catch {
      return []
    }
  })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [w, s] = await Promise.all([
      supabase.from('workouts').select('id, title, updated_at, section_id').is('date', null),
      supabase.from('library_sections').select('id, name'),
    ])
    setRows(w.data ?? [])
    setSections(s.data ?? [])
  }, [])

  // Reload when the detail pane changes (after a save or delete).
  useEffect(() => {
    load()
  }, [load, pathname])

  const toggle = (key: string) => {
    const next = collapsed.includes(key) ? collapsed.filter((k) => k !== key) : [...collapsed, key]
    setItem('librarySectionsCollapsed', JSON.stringify(next))
    setCollapsed(next)
  }

  async function run(p: PromiseLike<{ error: { message: string; code?: string } | null }>) {
    const { error } = await p
    setError(error ? (error.code === '23505' ? 'Une section porte déjà ce nom.' : error.message) : '')
    load()
  }
  const createSection = () => {
    const name = prompt('Nom de la nouvelle section (ex. Benchmark CrossFit, Hyrox, Haltéro)')?.trim()
    if (name) run(supabase.from('library_sections').insert({ name }))
  }
  const renameSection = (s: Section) => {
    const name = prompt('Nouveau nom de la section', s.name)?.trim()
    if (name && name !== s.name) run(supabase.from('library_sections').update({ name }).eq('id', s.id))
  }
  const deleteSection = (s: Section) => {
    if (confirm(`Supprimer la section « ${s.name} » ? Ses séances restent dans la bibliothèque, sans section.`))
      run(supabase.from('library_sections').delete().eq('id', s.id))
  }

  const filtered = searchExercises((rows ?? []).map((r) => ({ ...r, name: r.title })), query)
  const groups = groupBySection(filtered, sections).filter((g) => !query || g.items.length > 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Link to="/library/workouts/new" className="flex-1 rounded-xl bg-lime-400 py-3 text-center font-semibold text-zinc-950">
          + Nouvelle séance
        </Link>
        <button className="rounded-xl bg-zinc-800 px-4 font-semibold" onClick={createSection}>
          + Section
        </button>
      </div>
      <input
        placeholder="Rechercher une séance"
        className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-lime-400"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ErrorText>{error}</ErrorText>
      {rows?.length === 0 && <p className="text-zinc-400">Aucune séance pour l’instant.</p>}

      {groups.map((g) => {
        const key = g.id ?? 'none'
        const open = query !== '' || !collapsed.includes(key)
        const section = sections.find((s) => s.id === g.id)
        return (
          <section key={key} className="rounded-2xl bg-zinc-900">
            <div className="flex items-center gap-2 px-4 py-3">
              <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => toggle(key)} aria-expanded={open}>
                <span className="text-zinc-500">{open ? '▾' : '▸'}</span>
                <span className="truncate font-semibold">{g.name}</span>
                <span className="text-sm text-zinc-500">{g.items.length}</span>
              </button>
              {section && (
                <>
                  <Link
                    to={`/library/workouts/new?section=${section.id}`}
                    className="px-1 text-lg text-lime-400"
                    aria-label={`Nouvelle séance dans ${section.name}`}
                  >
                    +
                  </Link>
                  <button className="px-1 text-zinc-400" onClick={() => renameSection(section)} aria-label="Renommer la section">
                    ✎
                  </button>
                  <button className="px-1 text-sm text-red-400" onClick={() => deleteSection(section)} aria-label="Supprimer la section">
                    ✕
                  </button>
                </>
              )}
            </div>
            {open && g.items.length > 0 && (
              <ul className="divide-y divide-zinc-800 border-t border-zinc-800">
                {g.items.map((w) => (
                  <li key={w.id}>
                    <Link to={`/library/workouts/${w.id}`} className={itemClass(pathname.startsWith(`/library/workouts/${w.id}`))}>
                      <span className="truncate">{w.title}</span>
                      <span className="shrink-0 text-sm text-zinc-500">{dateFmt.format(new Date(w.updated_at))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {open && g.items.length === 0 && <p className="border-t border-zinc-800 px-4 py-3 text-sm text-zinc-500">Section vide.</p>}
          </section>
        )
      })}
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
