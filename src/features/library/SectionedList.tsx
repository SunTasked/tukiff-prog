import { useState, type ReactNode } from 'react'
import { groupBySection } from '../../domain/sections'
import { getItem, setItem } from '../../lib/storage'

export type Section = { id: string; name: string }

/** Items grouped in collapsible sections (collapsed by default, remembered on the device; opened while searching). */
export function SectionedList<T extends { id: string; name: string; section_id: string | null }>({
  items,
  sections,
  query,
  storageKey,
  hideEmpty = false,
  ordered = false,
  renderItem,
}: {
  items: T[]
  sections: Section[]
  query: string
  storageKey: string
  /** Hide sections left empty by a filter (as while searching). */
  hideEmpty?: boolean
  /** Keep the sections in the given order (A→Z otherwise). */
  ordered?: boolean
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
  const groups = groupBySection(items, sections, ordered).filter((g) => (!query && !hideEmpty) || g.items.length > 0)

  return (
    <>
      {groups.map((g) => {
        const key = g.id ?? 'none'
        const open = query !== '' || expanded.includes(key)
        return (
          <section key={key} className="rounded-2xl bg-zinc-900">
            <div className="flex items-center gap-2 px-4 py-3">
              <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => toggle(key)} aria-expanded={open}>
                <span className="text-zinc-500">{open ? '▾' : '▸'}</span>
                <span className="truncate font-semibold">{g.name}</span>
                <span className="text-sm text-zinc-500">{g.items.length}</span>
              </button>
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
