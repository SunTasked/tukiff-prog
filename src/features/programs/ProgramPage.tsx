import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, Card, ErrorText, Input, PageTitle, Spinner } from '../../components/ui'
import { supabase, type Profile, type Program } from '../../lib/supabase'

/** Program detail: who has access, grant access to more athletes, rename, archive. */
export function ProgramPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [program, setProgram] = useState<Program | null>(null)
  const [name, setName] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [everyone, setEveryone] = useState<Profile[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [p, pm, m] = await Promise.all([
      supabase.from('programs').select('*').eq('id', id!).single(),
      supabase.from('program_members').select('user_id').eq('program_id', id!),
      supabase.from('profiles').select('*').not('role', 'is', null).order('display_name'),
    ])
    setProgram(p.data)
    setName((n) => n || p.data?.name || '')
    setMemberIds((pm.data ?? []).map((r) => r.user_id))
    setEveryone(m.data ?? [])
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (!program) return <Spinner />

  const run = async (p: PromiseLike<{ error: { message: string; code?: string } | null }>) => {
    const { error } = await p
    setError(error ? (error.code === '23505' ? 'Un programme porte déjà ce nom.' : error.message) : '')
    await load()
  }

  const toggle = (userId: string) =>
    run(
      memberIds.includes(userId)
        ? supabase.from('program_members').delete().eq('program_id', id!).eq('user_id', userId)
        : supabase.from('program_members').insert({ program_id: id!, user_id: userId }),
    )

  async function archive() {
    if (!confirm(`Archiver « ${program!.name} » ? Ses athlètes perdront l’accès aux séances qui ne sont assignées qu’à ce programme.`))
      return
    await supabase.from('program_members').delete().eq('program_id', id!)
    const { error } = await supabase.from('programs').update({ archived_at: new Date().toISOString() }).eq('id', id!)
    if (error) setError(error.message)
    else navigate('/athletes')
  }

  return (
    <>
      <Link to="/athletes" className="text-sm text-zinc-400">
        ‹ Athlètes
      </Link>
      <PageTitle>{program.name}</PageTitle>
      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="mb-2 font-semibold">Accès ({memberIds.length})</h2>
          <ul>
            {everyone.map((m) => (
              <li key={m.id}>
                <label className="flex items-center gap-3 py-1.5">
                  <input
                    type="checkbox"
                    className="size-5 accent-lime-400"
                    checked={memberIds.includes(m.id)}
                    onChange={() => toggle(m.id)}
                  />
                  <span>{m.display_name ?? '—'}</span>
                  {m.role === 'coach' && <span className="text-xs text-zinc-500">coach</span>}
                </label>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex flex-col gap-2">
          <Input label="Nom" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            variant="secondary"
            disabled={!name.trim() || name.trim() === program.name}
            onClick={() => run(supabase.from('programs').update({ name: name.trim() }).eq('id', id!))}
          >
            Renommer
          </Button>
        </Card>
        <ErrorText>{error}</ErrorText>
        <button className="py-2 text-sm text-red-400 underline" onClick={archive}>
          Archiver le programme
        </button>
      </div>
    </>
  )
}
