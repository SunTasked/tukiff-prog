import { useEffect, useRef, useState } from 'react'
import { addDays, mondayOf, publicationStatus } from '../../domain/dates'
import type { Gender } from '../../domain/profile'
import { scoreType, weeklyLeaderboards } from '../../domain/scoring'
import { supabase } from '../../lib/supabase'
import { loadWorkout } from '../workouts/api'
import type { ResultRow } from './useWorkoutResults'

export type Athlete = ResultRow & { gender: Gender | null }
export type WeeklyBoards = ReturnType<typeof weeklyLeaderboards<Athlete>>
type Row = { id: string; date: string; program_id: string; publish_at: string | null }

/** Weekly leaderboard of one program (Monday to Sunday), from the published workouts of the week. */
async function fetchWeeklyBoards(programId: string, monday: string): Promise<{ enabled: boolean; boards: WeeklyBoards }> {
  const [{ data: week }, { data: program }] = await Promise.all([
    supabase.rpc('my_workouts', { p_from: monday, p_to: addDays(monday, 6) }),
    supabase.from('programs').select('leaderboard_enabled').eq('id', programId).maybeSingle(),
  ])
  const enabled = program?.leaderboard_enabled ?? true
  const ids = ((week ?? []) as Row[])
    // A multi-day workout started last week belongs to last week's board.
    .filter((w) => w.program_id === programId && w.date >= monday && publicationStatus(w.publish_at) === 'published')
    .map((w) => w.id)
  const [workouts, { data: results }] = await Promise.all([
    Promise.all(ids.map(loadWorkout)),
    ids.length
      ? supabase.from('results').select('*, profiles(display_name, gender, avatar_url)').in('workout_id', ids)
      : Promise.resolve({ data: [] }),
  ])
  const rows: Athlete[] = ((results ?? []) as ResultRow[]).map((r) => ({ ...r, gender: r.profiles?.gender ?? null }))
  const boards = weeklyLeaderboards(
    workouts.flatMap((w) =>
      (w?.blocks ?? []).map((b) => ({ type: scoreType(b.format, b.params), results: rows.filter((r) => r.block_id === b.id) })),
    ),
  )
  return { enabled, boards }
}

// Shared by the workouts of the same program on the home page; dropped when a score of the week changes.
const cache = new Map<string, Promise<{ enabled: boolean; boards: WeeklyBoards }>>()

export function loadWeeklyBoards(programId: string, monday: string, fresh = false) {
  const key = `${programId}|${monday}`
  if (fresh || !cache.has(key)) {
    const p = fetchWeeklyBoards(programId, monday)
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return cache.get(key)!
}

/**
 * Leaders (rank 1, ties included) of the week of `date` in the program, whatever the gender. Empty when the
 * leaderboard is off. Reloaded when `version` changes (the workout's scores were reloaded).
 */
export function useWeekLeaders(programId: string | null | undefined, date: string | null | undefined, version: unknown) {
  const [leaders, setLeaders] = useState<Set<string>>(new Set())
  const first = useRef(true)
  useEffect(() => {
    if (!programId || !date) return
    let live = true
    const fresh = !first.current
    first.current = false
    loadWeeklyBoards(programId, mondayOf(date), fresh).then(({ enabled, boards }) => {
      if (!live) return
      setLeaders(new Set(enabled ? boards.flatMap((b) => b.rows.filter((r) => r.rank === 1).map((r) => r.athlete.athlete_id)) : []))
    })
    return () => {
      live = false
    }
  }, [programId, date, version])
  return leaders
}
