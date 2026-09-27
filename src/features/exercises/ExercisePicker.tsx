import { useState } from 'react'
import { ErrorText } from '../../components/ui'
import type { Exercise } from '../../lib/supabase'
import { normalize, searchExercises } from './useExercises'

/** Full-screen search sheet; can create a missing exercise on the fly (when onCreate is given). */
export function ExercisePicker({
  exercises,
  onPick,
  onCreate,
  onClose,
}: {
  exercises: Exercise[]
  onPick: (e: Exercise) => void
  onCreate?: (name: string) => Promise<Exercise>
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const results = searchExercises(exercises, query)
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
        {results.map((e) => (
          <li key={e.id}>
            <button className="w-full border-b border-zinc-900 px-4 py-3 text-left" onClick={() => onPick(e)}>
              {e.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
