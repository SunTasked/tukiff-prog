import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Measure } from '../../domain/workout'
import { supabase, type Exercise } from '../../lib/supabase'

/** Whole exercise library (a few hundred rows at most). */
export function useExercises() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sections, setSections] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const [e, s] = await Promise.all([
      supabase.from('exercises').select('*').order('name'),
      supabase.from('exercise_sections').select('id, name').order('name'),
    ])
    setExercises(e.data ?? [])
    setSections(s.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const nameOf = useCallback((id: string) => byId.get(id)?.name, [byId])
  const measureOf = useCallback((id: string) => byId.get(id)?.measure as Measure | undefined, [byId])

  return { exercises, sections, loading, byId, nameOf, measureOf, reload }
}

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** Accent/case-insensitive search on a name. */
export function searchExercises<T extends { name: string }>(list: T[], query: string) {
  const q = normalize(query)
  if (!q) return list
  return list.filter((e) => normalize(e.name).includes(q))
}
