import type { BlockDraft, BlockKind, Format, FormatParams, ItemDraft, LevelOverride, WorkoutDraft } from '../../domain/workout'
import { supabase } from '../../lib/supabase'

export async function loadWorkout(id: string): Promise<WorkoutDraft | null> {
  const { data } = await supabase
    .from('workouts')
    .select('id, title, notes, date, section_id, workout_blocks(*, block_items(*))')
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
  return { id: data.id, title: data.title, notes: data.notes ?? '', date: data.date, section_id: data.section_id, blocks }
}

/** resetBlocks: blocks whose results must be deleted (scoring content changed). */
export async function saveWorkout(w: WorkoutDraft, resetBlocks: string[] = []): Promise<string> {
  const { data, error } = await supabase.rpc('save_workout', { p: { ...w, reset_blocks: resetBlocks } as never })
  if (error) throw new Error(error.message)
  // The section is a plain column of library templates, outside the save_workout tree.
  if (!w.date) {
    const res = await supabase.from('workouts').update({ section_id: w.section_id ?? null }).eq('id', data)
    if (res.error) throw new Error(res.error.message)
  }
  return data
}
