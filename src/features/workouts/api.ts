import type {
  AccessLevel,
  BlockDraft,
  BlockKind,
  Format,
  FormatParams,
  GroupDraft,
  ItemDraft,
  LevelOverride,
  WorkoutDraft,
} from '../../domain/workout'
import type { Tables } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'

// Sub-blocks are stored in the block params (no schema change, copied with the block): groups + item positions.
type StoredGroup = GroupDraft & { items: number[] }
type StoredParams = FormatParams & { groups?: StoredGroup[] }

function fromStored(params: StoredParams) {
  const { groups = [], ...rest } = params
  const groupOf = (i: number) => {
    const g = groups.findIndex((x) => x.items.includes(i))
    return g === -1 ? null : g
  }
  return {
    params: rest as FormatParams,
    groups: groups.map(({ title, note, start, step }) => ({ title, note, start, step })),
    groupOf,
  }
}

function toStored(b: BlockDraft): StoredParams {
  if (!b.groups.length) return b.params
  const groups = b.groups.map((g, gi) => ({
    ...g,
    items: b.items.flatMap((it, i) => (it.group === gi ? [i] : [])),
  }))
  return { ...b.params, groups }
}

/** A workout_blocks row with its block_items, as edited and displayed. */
export function toBlock(b: Tables<'workout_blocks'> & { block_items: Tables<'block_items'>[] }): BlockDraft {
  const { params, groups, groupOf } = fromStored(b.params as StoredParams)
  return {
    id: b.id,
    kind: b.kind as BlockKind,
    title: b.title ?? '',
    format: b.format as Format,
    params,
    notes: b.notes ?? '',
    groups,
    items: [...b.block_items]
      .sort((x, y) => x.position - y.position)
      .map(
        (i, index): ItemDraft => ({
          exercise_id: i.exercise_id,
          label: i.label ?? '',
          reps: i.reps ?? '',
          load_kg: i.load_kg,
          load_kg_f: i.load_kg_f,
          pct_1rm: i.pct_1rm,
          distance_m: i.distance_m,
          calories: i.calories,
          duration_s: i.duration_s,
          notes: i.notes ?? '',
          levels: i.levels as Record<string, LevelOverride>,
          group: groupOf(index),
        }),
      ),
  }
}

export async function loadWorkout(id: string): Promise<WorkoutDraft | null> {
  // Blocks above my access level are not readable: they come back through an RPC, without their content.
  const [{ data }, { data: locked }] = await Promise.all([
    supabase
      .from('workouts')
      .select('id, title, notes, date, days, section_id, programs(access_levels), workout_blocks(*, block_items(*))')
      .eq('id', id)
      .maybeSingle(),
    supabase.rpc('locked_blocks', { p_workouts: [id] }),
  ])
  if (!data) return null
  const positions = data.workout_blocks.map((b) => b.position)
  const blocks = [...data.workout_blocks].sort((a, b) => a.position - b.position).map(toBlock)
  return {
    id: data.id,
    title: data.title,
    notes: data.notes ?? '',
    date: data.date,
    days: data.days,
    section_id: data.section_id,
    access_levels: data.programs?.access_levels as AccessLevel[] | undefined,
    blocks,
    locked: (locked ?? []).map((b) => ({
      id: b.id,
      kind: b.kind as BlockKind,
      title: b.title ?? '',
      before: positions.filter((p) => p < b.position).length,
    })),
  }
}

/** resetBlocks: blocks whose results must be deleted (scoring content changed). */
export async function saveWorkout(w: WorkoutDraft, resetBlocks: string[] = []): Promise<string> {
  const blocks = w.blocks.map((b) => ({ ...b, params: toStored(b) }))
  const { data, error } = await supabase.rpc('save_workout', {
    p: { ...w, blocks, reset_blocks: resetBlocks } as never,
  })
  if (error) throw new Error(error.message)
  // The section is a plain column of library templates, outside the save_workout tree.
  if (!w.date) {
    const res = await supabase
      .from('workouts')
      .update({ section_id: w.section_id ?? null })
      .eq('id', data)
    if (res.error) throw new Error(res.error.message)
  }
  return data
}
