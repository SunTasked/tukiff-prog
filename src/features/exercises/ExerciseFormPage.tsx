import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button, Chips, ErrorText, Input, PageTitle, Textarea } from '../../components/ui'
import { MEASURES, type Measure } from '../../domain/workout'
import { supabase } from '../../lib/supabase'

export function ExerciseFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [measure, setMeasure] = useState<Measure>('reps')
  const [error, setError] = useState('')

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
      })
  }, [id])

  const back = () => navigate('/library?tab=exercises')

  async function save(e: FormEvent) {
    e.preventDefault()
    const values = {
      name: name.trim(),
      description: description.trim() || null,
      video_url: videoUrl.trim() || null,
      measure,
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
    if (!error) return back()
    if (error.code === '23503') {
      const { data } = await supabase.from('block_items').select('workout_blocks(workout_id)').eq('exercise_id', id!)
      const n = new Set((data ?? []).map((r) => r.workout_blocks?.workout_id)).size
      setError(`Impossible : exercice utilisé dans ${n} séance${n > 1 ? 's' : ''}.`)
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
