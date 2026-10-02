import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Button, Chips, ErrorText, Input, PageTitle, Textarea } from '../../components/ui'
import { MEASURES, type Measure } from '../../domain/workout'
import { supabase } from '../../lib/supabase'

export function ExerciseFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [measure, setMeasure] = useState<Measure>('reps')
  const [sectionId, setSectionId] = useState(search.get('section') ?? '')
  const [sections, setSections] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('exercise_sections')
      .select('id, name')
      .order('name')
      .then(({ data }) => setSections(data ?? []))
  }, [])

  useEffect(() => {
    if (!id) return
    supabase
      .from('exercises')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return
        setName(data.name)
        setDescription(data.description ?? '')
        setVideoUrl(data.video_url ?? '')
        setMeasure(data.measure as Measure)
        setSectionId(data.section_id ?? '')
      })
  }, [id])

  const back = () => navigate(id ? `/library/exercises/${id}` : '/library?tab=exercises')

  async function save(e: FormEvent) {
    e.preventDefault()
    const values = {
      name: name.trim(),
      description: description.trim() || null,
      video_url: videoUrl.trim() || null,
      measure,
      section_id: sectionId || null,
    }
    const { error } = id
      ? await supabase.from('exercises').update(values).eq('id', id)
      : await supabase.from('exercises').insert(values)
    if (!error) return back()
    if (error.code === '23505') setError('Un exercice porte déjà ce nom.')
    else if (error.code === '23514') setError('Le lien vidéo doit commencer par http:// ou https://.')
    else setError(error.message)
  }

  async function remove() {
    if (!confirm(`Supprimer « ${name} » ?`)) return
    const { error } = await supabase.from('exercises').delete().eq('id', id!)
    if (!error) return navigate('/library?tab=exercises')
    if (error.code === '23503') {
      const [{ data }, { count: records }] = await Promise.all([
        supabase.from('block_items').select('workout_blocks(workout_id)').eq('exercise_id', id!),
        supabase.from('personal_records').select('id', { count: 'exact', head: true }).eq('exercise_id', id!),
      ])
      const n = new Set((data ?? []).map((r) => r.workout_blocks?.workout_id)).size
      const uses = [
        n > 0 && `${n} séance${n > 1 ? 's' : ''}`,
        records && `${records} record${records > 1 ? 's' : ''} d’athlète`,
      ].filter(Boolean)
      setError(`Impossible : exercice utilisé dans ${uses.join(' et ') || 'des données existantes'}.`)
    } else setError(error.message)
  }

  return (
    <>
      <PageTitle>{id ? 'Modifier l’exercice' : 'Nouvel exercice'}</PageTitle>
      <form onSubmit={save} className="flex flex-col gap-4">
        <Input label="Nom" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <span className="mb-1 block text-sm text-zinc-400">Mesure principale</span>
          <Chips options={MEASURES} value={measure} onChange={setMeasure} />
        </div>
        <label className="block">
          <span className="mb-1 block text-sm text-zinc-400">Section</span>
          <select
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">Sans section</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input
          label="Lien vidéo"
          type="url"
          placeholder="https://youtube.com/…"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
        <ErrorText>{error}</ErrorText>
        <Button>Enregistrer</Button>
        <Button type="button" variant="secondary" onClick={back}>
          Annuler
        </Button>
        {id && (
          <button type="button" className="py-2 text-sm text-red-400 underline" onClick={remove}>
            Supprimer l’exercice
          </button>
        )}
      </form>
    </>
  )
}
