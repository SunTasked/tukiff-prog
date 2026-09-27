import { useState } from 'react'
import { ErrorText } from '../../components/ui'
import { groupBySection } from '../../domain/sections'
import type { Exercise } from '../../lib/supabase'
import { normalize, searchExercises } from './useExercises'

/**
 * Full-screen search sheet, grouped by section until a search is typed; can create a missing exercise (when onCreate is given).
 * `used`: exercises already in the workout, listed first.
 */
export function ExercisePicker({
  exercises,
  sections = [],
  used = [],
  onPick,
  onCreate,
  onClose,
}: {
  exercises: Exercise[]
  sections?: { id: string; name: string }[]
  used?: string[]
  onPick: (e: Exercise) => void
  onCreate?: (name: string) => Promise<Exercise>
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const results = searchExercises(exercises, query)
  const usedSet = new Set(used)
  const usedItems = used.flatMap((id) => results.filter((e) => e.id === id))
  const rest = results.filter((e) => !usedSet.has(e.id))
  const groups = [
    ...(usedItems.length ? [{ id: 'used', name: 'Dans la séance', items: usedItems }] : []),
    ...(query.trim() || !sections.length ? [{ id: null, name: usedItems.length ? 'Autres' : '', items: rest }] : groupBySection(rest, sections)),
  ]
  const exact = exercises.some((e) => normalize(e.name) === normalize(query))

  async function create() {
    try {
      if (onCreate) onPick(await onCreate(query))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 border-b border-zinc-800 p-3">
        <input
          autoFocus
          placeholder="Rechercher un exercice"
          className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-lime-400"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="px-2 text-zinc-400" onClick={onClose}>
          Annuler
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {onCreate && query.trim() && !exact && (
          <li>
            <button className="w-full px-4 py-3 text-left text-lime-400" onClick={create}>
              + Créer « {query.trim()} »
            </button>
            <div className="px-4">
              <ErrorText>{error}</ErrorText>
            </div>
          </li>
        )}
        {groups.map((g) => (
          <li key={g.id ?? 'none'}>
            {g.name && <p className="sticky top-0 bg-zinc-950 px-4 pt-4 pb-1 text-xs font-semibold text-zinc-500 uppercase">{g.name}</p>}
            <ul>
              {g.items.map((e) => (
                <li key={e.id}>
                  <button className="w-full border-b border-zinc-900 px-4 py-3 text-left" onClick={() => onPick(e)}>
                    {e.name}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
