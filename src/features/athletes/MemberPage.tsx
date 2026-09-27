import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Card, ErrorText, PageTitle, Spinner } from '../../components/ui'
import { supabase, type Profile } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useTeam } from '../programs/useTeam'

/** Member detail (coach): programs the member has access to, remove access. */
export function MemberPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { programs } = useTeam()
  const [member, setMember] = useState<Profile | null>(null)
  const [programIds, setProgramIds] = useState<string[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [m, pm] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id!).single(),
      supabase.from('program_members').select('program_id').eq('user_id', id!),
    ])
    setMember(m.data)
    setProgramIds((pm.data ?? []).map((r) => r.program_id))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (!member) return <Spinner />

  async function toggle(programId: string) {
    const { error } = programIds.includes(programId)
      ? await supabase.from('program_members').delete().eq('program_id', programId).eq('user_id', id!)
      : await supabase.from('program_members').insert({ program_id: programId, user_id: id! })
    setError(error?.message ?? '')
    load()
  }

  async function removeAccess() {
    if (!confirm(`Retirer l’accès de ${member!.display_name ?? 'ce membre'} ? Il pourra être réinvité.`)) return
    const { error } = await supabase.rpc('remove_member', { p_user: id! })
    if (error) setError(error.message)
    else navigate('/athletes')
  }

  return (
    <>
      <Link to="/athletes" className="text-sm text-zinc-400">
        ‹ Athlètes
      </Link>
      <PageTitle>{member.display_name ?? '—'}</PageTitle>
      <p className="-mt-3 mb-4 text-sm text-zinc-400">
        {member.role === 'coach' ? 'Coach' : 'Athlète'}
        {member.share_scores ? ' · scores partagés' : ''}
      </p>
      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="mb-2 font-semibold">Programmes</h2>
          {programs.length === 0 && <p className="text-sm text-zinc-400">Aucun programme pour l’instant.</p>}
          <ul>
            {programs.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-3 py-1.5">
                  <input
                    type="checkbox"
                    className="size-5 accent-lime-400"
                    checked={programIds.includes(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span>{p.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
        <ErrorText>{error}</ErrorText>
        {member.id !== session?.user.id && (
          <button className="py-2 text-sm text-red-400 underline" onClick={removeAccess}>
            Retirer l’accès à l’application
          </button>
        )}
      </div>
    </>
  )
}
