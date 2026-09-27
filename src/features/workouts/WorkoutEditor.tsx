import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button, ErrorText, Input, Spinner, Textarea } from '../../components/ui'
import {
  emptyItem,
  newBlock,
  suggestedKind,
  validateWorkout,
  type AltLevel,
  type BlockDraft,
  type WorkoutDraft,
} from '../../domain/workout'
import type { Exercise } from '../../lib/supabase'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { useExercises } from '../exercises/useExercises'
import { loadWorkout, saveWorkout } from './api'
import { BlockEditor } from './BlockEditor'

type PickTarget = { block: number; item: number | null; level?: AltLevel }

export function WorkoutEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { exercises, byId, nameOf, create } = useExercises()
  const [draft, setDraft] = useState<WorkoutDraft | null>(
    id ? null : { title: '', notes: '', blocks: [newBlock('warmup', crypto.randomUUID())] },
  )
  const [pick, setPick] = useState<PickTarget | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (id) loadWorkout(id).then(setDraft)
  }, [id])

  if (!draft) return <Spinner />

  const setBlocks = (blocks: BlockDraft[]) => setDraft({ ...draft, blocks })
  const updateBlock = (i: number, b: BlockDraft) => setBlocks(draft.blocks.map((x, j) => (j === i ? b : x)))

  function moveBlock(i: number, delta: -1 | 1) {
    const blocks = [...draft!.blocks]
    ;[blocks[i], blocks[i + delta]] = [blocks[i + delta], blocks[i]]
    setBlocks(blocks)
  }

  function onPicked(ex: Exercise) {
    const { block: bi, item: ii, level } = pick!
    const block = draft!.blocks[bi]
    let items
    if (ii === null) items = [...block.items, emptyItem(ex.id)]
    else if (level) {
      items = block.items.map((it, j) =>
        j === ii ? { ...it, levels: { ...it.levels, [level]: { ...it.levels[level], exercise_id: ex.id } } } : it,
      )
    } else items = block.items.map((it, j) => (j === ii ? { ...it, exercise_id: ex.id } : it))
    updateBlock(bi, { ...block, items })
    setPick(null)
  }

  async function save() {
    const invalid = validateWorkout(draft!)
    if (invalid) return setError(invalid)
    setSaving(true)
    try {
      const savedId = await saveWorkout(draft!)
      navigate(`/library/workouts/${savedId}`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <Input
          label="Titre de la séance"
          required
          maxLength={120}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        {draft.blocks.map((b, i) => (
          <BlockEditor
            key={b.id}
            block={b}
            index={i}
            count={draft.blocks.length}
            byId={byId}
            nameOf={nameOf}
            onChange={(nb) => updateBlock(i, nb)}
            onMove={(d) => moveBlock(i, d)}
            onRemove={() => setBlocks(draft.blocks.filter((_, j) => j !== i))}
            onPick={(item, level) => setPick({ block: i, item, level })}
          />
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setBlocks([...draft.blocks, newBlock(suggestedKind(draft.blocks.length), crypto.randomUUID())])}
        >
          + Bloc
        </Button>
        <Textarea
          label="Notes de la séance"
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 mx-auto max-w-md px-4">
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(id ? `/library/workouts/${id}` : '/library')}>
            Annuler
          </Button>
          <Button type="button" className="flex-1 shadow-lg" disabled={saving} onClick={save}>
            Enregistrer
          </Button>
        </div>
      </div>
      <div className="h-20" />

      {pick && (
        <ExercisePicker exercises={exercises} onPick={onPicked} onCreate={(n) => create(n)} onClose={() => setPick(null)} />
      )}
    </>
  )
}
