import type { BlockDraft, BlockKind, Format, FormatParams, ItemDraft, LevelOverride, WorkoutDraft } from '../../domain/workout'
import { supabase } from '../../lib/supabase'

export async function loadWorkout(id: string): Promise<WorkoutDraft | null> {
  const { data } = await supabase
    .from('workouts')
    .select('id, title, notes, workout_blocks(*, block_items(*))')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const blocks: BlockDraft[] = [...data.workout_blocks]
    .sort((a, b) => a.position - b.position)
    .map((b) => ({
      id: b.id,
      kind: b.kind as BlockKind,
      title: b.title ?? '',
      format: b.format as Format,
      params: b.params as FormatParams,
      notes: b.notes ?? '',
      items: [...b.block_items]
        .sort((x, y) => x.position - y.position)
        .map(
          (i): ItemDraft => ({
            exercise_id: i.exercise_id,
            label: i.label ?? '',
            reps: i.reps ?? '',
            load_kg: i.load_kg,
            pct_1rm: i.pct_1rm,
            distance_m: i.distance_m,
            calories: i.calories,
            duration_s: i.duration_s,
            notes: i.notes ?? '',
            levels: i.levels as Record<string, LevelOverride>,
          }),
        ),
    }))
  return { id: data.id, title: data.title, notes: data.notes ?? '', blocks }
}

export async function saveWorkout(w: WorkoutDraft): Promise<string> {
  const { data, error } = await supabase.rpc('save_workout', { p: w as never })
  if (error) throw new Error(error.message)
  return data
}
