import { useEffect, useState } from 'react'
import type { ScoreType } from '../../domain/scoring'
import { supabase } from '../../lib/supabase'
import { searchExercises } from '../exercises/useExercises'
import { SectionedList, type Section } from '../library/SectionedList'

/** One score of a library benchmark: its name is the benchmark's, plus the block's when it has several scores. */
export type BenchmarkScore = { name: string; score_type: ScoreType }
type Benchmark = { id: string; name: string; section_id: string | null; scores: (BenchmarkScore & { label: string })[] }

/** Library benchmarks by section (collapsed by default), with a search; one choice per scored block. */
export function BenchmarkPicker({ onPick, onClose }: { onPick: (b: BenchmarkScore) => void; onClose: () => void }) {
  const [items, setItems] = useState<Benchmark[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase.rpc('record_benchmarks').then(({ data }) => {
      const byId = new Map<string, Benchmark>()
      const secs = new Map<string, Section>()
      for (const r of (data ?? []).sort((a, b) => a.block_position - b.block_position)) {
        const b = byId.get(r.id) ?? { id: r.id, name: r.title, section_id: r.section_id, scores: [] }
        const label = r.block_title?.trim() || `Bloc ${b.scores.length + 1}`
        b.scores.push({ label, name: r.title, score_type: r.score_type as ScoreType })
        byId.set(r.id, b)
        if (r.section_id) secs.set(r.section_id, { id: r.section_id, name: r.section_name ?? '' })
      }
      for (const b of byId.values()) if (b.scores.length > 1) for (const s of b.scores) s.name = `${b.name} · ${s.label}`
      setItems([...byId.values()])
      setSections([...secs.values()])
    })
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 border-b border-zinc-800 p-3">
        <input
          placeholder="Rechercher un benchmark"
          className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-lime-400"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="px-2 text-zinc-400" onClick={onClose}>
          Annuler
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <SectionedList
          items={searchExercises(items, query)}
          sections={sections}
          query={query}
          storageKey="benchmarkSectionsExpanded"
          what="benchmarks"
          renderItem={(b) =>
            b.scores.length === 1 ? (
              <button className="w-full truncate px-4 py-3 text-left" onClick={() => onPick(b.scores[0])}>
                {b.name}
              </button>
            ) : (
              <div className="px-4 py-3">
                <div className="truncate">{b.name}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {b.scores.map((s) => (
                    <button key={s.name} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm" onClick={() => onPick(s)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          }
        />
      </div>
    </div>
  )
}
