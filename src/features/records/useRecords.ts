import { useCallback, useEffect, useMemo, useState } from 'react'
import { oneRepMaxes, withInherited, type LiftParents, type LoadRecord } from '../../domain/records'
import { supabase, type PersonalRecord } from '../../lib/supabase'

// The lift hierarchy is fed in the database and rarely changes: loaded once per app session.
let parentsOnce: Promise<LiftParents> | null = null
function loadParents() {
  parentsOnce ??= Promise.resolve(supabase.from('exercise_links').select('exercise_id, parent_id')).then(({ data }) => {
    const out: LiftParents = new Map()
    for (const l of data ?? []) out.set(l.exercise_id, [...(out.get(l.exercise_id) ?? []), l.parent_id])
    return out
  })
  return parentsOnce
}

/** Lift hierarchy (Power Snatch -> Snatch). */
export function useLiftParents() {
  const [parents, setParents] = useState<LiftParents>(new Map())
  useEffect(() => {
    loadParents().then(setParents)
  }, [])
  return parents
}

/**
 * Personal records of one athlete (RLS: own, or any for coaches).
 * loads: with the records inherited from variants (via), so a parent lift's best and 1RM count them.
 */
export function useRecords(athleteId: string | undefined) {
  const [records, setRecords] = useState<PersonalRecord[]>([])
  const parents = useLiftParents()

  const reload = useCallback(async () => {
    if (!athleteId) return
    const { data } = await supabase.from('personal_records').select('*').eq('athlete_id', athleteId).order('date', { ascending: false })
    setRecords(data ?? [])
  }, [athleteId])

  useEffect(() => {
    reload()
  }, [reload])

  const loads = useMemo(
    () =>
      withInherited(
        records.filter((r): r is PersonalRecord & LoadRecord => r.exercise_id !== null && r.load_kg !== null),
        parents,
      ),
    [records, parents],
  )
  const oneRms = useMemo(() => oneRepMaxes(loads), [loads])
  return { records, loads, oneRms, reload }
}
