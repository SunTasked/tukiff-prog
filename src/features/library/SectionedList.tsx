import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ErrorText } from '../../components/ui'
import { groupBySection } from '../../domain/sections'
import { getItem, setItem } from '../../lib/storage'
import { supabase } from '../../lib/supabase'

export type Section = { id: string; name: string }
type SectionTable = 'library_sections' | 'exercise_sections'

/** Create / rename / delete sections of a library table; `reload` runs after each change. */
export function useSectionActions(table: SectionTable, reload: () => void) {
  const [error, setError] = useState('')
  async function run(p: PromiseLike<{ error: { message: string; code?: string } | null }>) {
    const { error } = await p
    setError(error ? (error.code === '23505' ? 'Une section porte déjà ce nom.' : error.message) : '')
    reload()
  }
  return {
    error,
    create: (example: string) => {
      const name = prompt(`Nom de la nouvelle section (ex. ${example})`)?.trim()
      if (name) run(supabase.from(table).insert({ name }))
    },
    rename: (s: Section) => {
      const name = prompt('Nouveau nom de la section', s.name)?.trim()
      if (name && name !== s.name) run(supabase.from(table).update({ name }).eq('id', s.id))
    },
    remove: (s: Section, what: string) => {
      if (confirm(`Supprimer la section « ${s.name} » ? Ses ${what} restent dans la bibliothèque, sans section.`))
        run(supabase.from(table).delete().eq('id', s.id))
    },
  }
}

/** Items grouped in collapsible sections (collapsed by default, remembered on the device; opened while searching). */
export function SectionedList<T extends { id: string; name: string; section_id: string | null }>({
  items,
  sections,
  query,
  storageKey,
  actions,
  what,
  newHref,
  renderItem,
}: {
  items: T[]
  sections: Section[]
  query: string
  storageKey: string
  actions: ReturnType<typeof useSectionActions>
  /** Plural noun for the items ("séances", "exercices"). */
  what: string
  newHref?: (s: Section) => string
  renderItem: (item: T) => ReactNode
}) {
  const [expanded, setExpanded] = useState<string[]>(() => {
    try {
      return JSON.parse(getItem(storageKey) ?? '[]')
    } catch {
      return []
    }
  })
  const toggle = (key: string) => {
    const next = expanded.includes(key) ? expanded.filter((k) => k !== key) : [...expanded, key]
    setItem(storageKey, JSON.stringify(next))
    setExpanded(next)
  }
  const groups = groupBySection(items, sections).filter((g) => !query || g.items.length > 0)

  return (
    <>
      <ErrorText>{actions.error}</ErrorText>
      {groups.map((g) => {
        const key = g.id ?? 'none'
        const open = query !== '' || expanded.includes(key)
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
                  {newHref && (
                    <Link to={newHref(section)} className="px-1 text-lg text-lime-400" aria-label={`Ajouter dans ${section.name}`}>
                      +
                    </Link>
                  )}
                  <button className="px-1 text-zinc-400" onClick={() => actions.rename(section)} aria-label="Renommer la section">
                    ✎
                  </button>
                  <button className="px-1 text-sm text-red-400" onClick={() => actions.remove(section, what)} aria-label="Supprimer la section">
                    ✕
                  </button>
                </>
              )}
            </div>
            {open && g.items.length > 0 && (
              <ul className="divide-y divide-zinc-800 border-t border-zinc-800">
                {g.items.map((item) => (
                  <li key={item.id}>{renderItem(item)}</li>
                ))}
              </ul>
            )}
            {open && g.items.length === 0 && <p className="border-t border-zinc-800 px-4 py-3 text-sm text-zinc-500">Section vide.</p>}
          </section>
        )
      })}
    </>
  )
}
