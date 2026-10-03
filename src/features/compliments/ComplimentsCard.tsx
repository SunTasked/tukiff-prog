import { useEffect, useState, type FormEvent } from 'react'
import { Button, Card, CloseButton, ErrorText, Input } from '../../components/ui'
import { clapCompliments } from '../../lib/clapsNotification'
import { supabase, type ClapCompliment } from '../../lib/supabase'

/** Communauté, admins only: the compliments drawn at random in the claps notification (Messages). */
export function ComplimentsCard() {
  const [list, setList] = useState<ClapCompliment[]>([])
  const [editing, setEditing] = useState<ClapCompliment | 'new' | null>(null)
  const reload = () => clapCompliments().then(setList)
  useEffect(() => {
    void reload()
  }, [])

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-400">Compliments des claps 👏 ({list.length})</h3>
        <button
          className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-lime-400 text-xl leading-none font-semibold text-zinc-950"
          aria-label="Ajouter un compliment"
          onClick={() => setEditing('new')}
        >
          +
        </button>
      </div>
      {list.length > 0 && (
        <ul className="divide-y divide-zinc-800">
          {list.map((c) => (
            <li key={c.id}>
              <button className="flex w-full items-center gap-3 py-2 text-left" onClick={() => setEditing(c)}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{c.text}</span>
                  {c.text_female && <span className="truncate text-xs text-zinc-500">♀ {c.text_female}</span>}
                </span>
                <span className="text-zinc-500">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <ComplimentSheet
          compliment={editing === 'new' ? null : editing}
          onClose={(changed) => {
            setEditing(null)
            if (changed) void reload()
          }}
        />
      )}
    </Card>
  )
}

function ComplimentSheet({ compliment, onClose }: { compliment: ClapCompliment | null; onClose: (changed?: boolean) => void }) {
  const [text, setText] = useState(compliment?.text ?? '')
  const [female, setFemale] = useState(compliment?.text_female ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const fields = { text: text.trim(), text_female: female.trim() || null }
    const { error } = compliment
      ? await supabase.from('clap_compliments').update(fields).eq('id', compliment.id)
      : await supabase.from('clap_compliments').insert(fields)
    setBusy(false)
    if (error) return setError(error.message)
    onClose(true)
  }

  async function remove() {
    if (!compliment || !confirm(`Supprimer « ${compliment.text} » ?`)) return
    const { error } = await supabase.from('clap_compliments').delete().eq('id', compliment.id)
    if (error) return setError(error.message)
    onClose(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 pt-[env(safe-area-inset-top)] lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black">
      <div className="flex items-center justify-between border-b border-zinc-800 p-3">
        <span className="font-semibold">{compliment ? 'Modifier le compliment' : 'Nouveau compliment'}</span>
        <CloseButton onClick={() => onClose()} />
      </div>
      <form onSubmit={save} className="flex flex-col gap-4 overflow-y-auto p-4">
        <Input label="Compliment" required maxLength={80} placeholder="C'est qui le patron ?!" value={text} onChange={(e) => setText(e.target.value)} />
        <Input
          label="Version féminine (si différente)"
          maxLength={80}
          placeholder="C'est qui la patronne ?!"
          value={female}
          onChange={(e) => setFemale(e.target.value)}
        />
        <p className="text-xs text-zinc-500">Affiché entre parenthèses après « 3 athlètes ont clappé ta perf pendant ta récup 👏 ».</p>
        <ErrorText>{error}</ErrorText>
        <Button disabled={busy || !text.trim()}>{compliment ? 'Enregistrer' : 'Ajouter'}</Button>
        {compliment && (
          <Button type="button" variant="danger" onClick={remove}>
            Supprimer
          </Button>
        )}
      </form>
    </div>
  )
}
