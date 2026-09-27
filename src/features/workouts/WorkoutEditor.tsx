import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Button, ErrorText, Input, Spinner, Textarea } from '../../components/ui'
import {
  BLOCK_KINDS,
  emptyItem,
  invalidatedBlocks,
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
import { WorkoutView } from './WorkoutView'

type PickTarget = { block: number; item: number | null; level?: AltLevel }

export function WorkoutEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const { exercises, byId, nameOf, create } = useExercises()
  const [draft, setDraft] = useState<WorkoutDraft | null>(
    id ? null : { title: '', notes: '', date: search.get('date'), program_id: search.get('program'), blocks: [newBlock('warmup', crypto.randomUUID())] },
  )
  const [original, setOriginal] = useState<WorkoutDraft | null>(null)
  const [pick, setPick] = useState<PickTarget | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (id)
      loadWorkout(id).then((w) => {
        setDraft(w)
        setOriginal(w)
      })
  }, [id])

  // Ctrl/Cmd + S saves (desktop).
  const saveRef = useRef<() => void>(() => {})
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
    const { changed, removed } = original ? invalidatedBlocks(original, draft!) : { changed: [], removed: [] }
    if (!(await confirmScoreLoss([...changed, ...removed]))) return
    setSaving(true)
    try {
      const savedId = await saveWorkout(draft!, changed)
      navigate(draft!.date ? `/calendar/workouts/${savedId}` : `/library/workouts/${savedId}`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  /** Warns when saving deletes existing scores; true to proceed. */
  async function confirmScoreLoss(blockIds: string[]) {
    if (!blockIds.length) return true
    const { data } = await supabase.from('results').select('block_id').in('block_id', blockIds)
    if (!data?.length) return true
    const counts = new Map<string, number>()
    for (const r of data) counts.set(r.block_id, (counts.get(r.block_id) ?? 0) + 1)
    const lines = original!.blocks
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => counts.has(b.id))
      .map(({ b, i }) => `• ${String.fromCharCode(65 + i)} · ${b.title || BLOCK_KINDS[b.kind]} : ${counts.get(b.id)} score(s)`)
    return confirm(
      `Attention : ces blocs ont été modifiés ou supprimés, leurs scores seront définitivement supprimés.\n\n${lines.join('\n')}\n\nEnregistrer quand même ?`,
    )
  }

  saveRef.current = () => {
    if (!saving) save()
  }

  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
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

      {/* Desktop: live preview, as athletes will see it */}
      <aside className="sticky top-8 hidden max-h-[calc(100dvh-4rem)] overflow-y-auto lg:block">
        <p className="mb-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">Aperçu</p>
        <h2 className="mb-3 text-2xl font-bold">{draft.title || 'Sans titre'}</h2>
        <WorkoutView workout={draft} nameOf={nameOf} />
      </aside>

      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 mx-auto max-w-md px-4 lg:bottom-6 lg:left-56 lg:max-w-7xl lg:px-8">
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2 lg:w-[calc(50%-1rem)]">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Annuler
          </Button>
          <Button type="button" className="flex-1 shadow-lg" disabled={saving} onClick={save}>
            Enregistrer <span className="hidden text-sm opacity-60 lg:inline">(Ctrl+S)</span>
          </Button>
        </div>
      </div>
      <div className="h-20 lg:col-span-2" />

      {pick && (
        <ExercisePicker exercises={exercises} onPick={onPicked} onCreate={(n) => create(n)} onClose={() => setPick(null)} />
      )}
    </div>
  )
}
