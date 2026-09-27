import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Measure } from '../../domain/workout'
import { supabase, type Exercise } from '../../lib/supabase'

/** Whole exercise library (a few hundred rows at most). */
export function useExercises() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data } = await supabase.from('exercises').select('*').order('name')
    setExercises(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const nameOf = useCallback((id: string) => byId.get(id)?.name, [byId])

  const create = useCallback(
    async (name: string, measure: Measure = 'reps') => {
      const { data, error } = await supabase.from('exercises').insert({ name: name.trim(), measure }).select().single()
      if (error) throw new Error(error.code === '23505' ? 'Cet exercice existe déjà.' : error.message)
      setExercises((list) => [...list, data].sort((a, b) => a.name.localeCompare(b.name)))
      return data
    },
    [],
  )

  return { exercises, loading, byId, nameOf, reload, create }
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
