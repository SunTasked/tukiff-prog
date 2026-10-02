import { useCallback, useEffect, useMemo, useState } from 'react'
import { oneRepMaxes, type LoadRecord } from '../../domain/records'
import { supabase, type PersonalRecord } from '../../lib/supabase'

/** Personal records of one athlete (RLS: own, or any for coaches). */
export function useRecords(athleteId: string | undefined) {
  const [records, setRecords] = useState<PersonalRecord[]>([])

  const reload = useCallback(async () => {
    if (!athleteId) return
    const { data } = await supabase
      .from('personal_records')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('date', { ascending: false })
    setRecords(data ?? [])
  }, [athleteId])

  useEffect(() => {
    reload()
  }, [reload])

  const loads = useMemo(() => records.filter((r): r is PersonalRecord & LoadRecord => r.exercise_id !== null && r.load_kg !== null), [records])
  const oneRms = useMemo(() => oneRepMaxes(loads), [loads])
  return { records, loads, oneRms, reload }
}
