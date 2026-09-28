import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Card, Chips, ErrorText, PageTitle, Spinner } from '../../components/ui'
import { supabase, type Profile } from '../../lib/supabase'
import { isAdmin, roleLabel, useAuth } from '../auth/AuthProvider'
import { useMyPrograms } from '../programs/useMyPrograms'
import { useExercises } from '../exercises/useExercises'
import { RecordsList } from '../records/RecordsList'
import { useRecords } from '../records/useRecords'
import { AthleteReport } from './AthleteReport'

const TABS = { report: 'Compte rendu', access: 'Accès', records: 'Records' }

/** Member detail (coach): report on my programs, programs the member has access to, records. */
export function MemberPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, profile: me } = useAuth()
  const admin = isAdmin(me)
  const { programs: mine } = useMyPrograms()
  const programs = mine ?? []
  const { nameOf } = useExercises()
  const { records } = useRecords(id)
  const [member, setMember] = useState<Profile | null>(null)
  const [programIds, setProgramIds] = useState<string[]>([])
  const [allPrograms, setAllPrograms] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState('')
  const [tab, setTab] = useState<keyof typeof TABS>('report')
  // Report: only the programs I edit that the member follows.
  const shared = useMemo(
    () => (mine ?? []).filter((p) => programIds.includes(p.id)).map((p) => ({ id: p.id, name: p.name })),
    [mine, programIds],
  )

  const load = useCallback(async () => {
    const [m, pm] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id!).single(),
      supabase.from('program_members').select('program_id, programs(name, archived_at)').eq('user_id', id!),
    ])
    setMember(m.data)
    setProgramIds((pm.data ?? []).map((r) => r.program_id))
    setAllPrograms(
      (pm.data ?? []).flatMap((r) => (r.programs && !r.programs.archived_at ? [{ id: r.program_id, name: r.programs.name }] : [])),
    )
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

  async function setRole(role: 'athlete' | 'coach' | 'admin') {
    const label = { athlete: 'athlète', coach: 'coach', admin: 'admin' }[role]
    const warning =
      role === 'athlete' && member!.role === 'coach' ? '\nSes programmations te seront transférées.' : ''
    if (!confirm(`Passer ${member!.display_name ?? 'ce membre'} en ${label} ?${warning}`)) return
    const { error } = await supabase.rpc('set_member_role', { p_user: id!, p_role: role })
    setError(error ? translate(error.message) : '')
    load()
  }

  async function removeAccess() {
    if (!confirm(`Retirer l’accès de ${member!.display_name ?? 'ce membre'} ? Il pourra être réinvité.`)) return
    const { error } = await supabase.rpc('remove_member', { p_user: id! })
    if (error) setError(translate(error.message))
    else navigate('/athletes')
  }

  return (
    <>
      <Link to="/athletes" className="text-sm text-zinc-400">
        ‹ Athlètes
      </Link>
      <PageTitle>{member.display_name ?? '—'}</PageTitle>
      <p className="-mt-3 mb-4 text-sm text-zinc-400">
        {roleLabel(member)}
        {member.is_app_owner ? ' · propriétaire de l’app' : ''}
      </p>
      <div className="mb-4">
        <Chips options={TABS} value={tab} onChange={setTab} />
      </div>
      {tab === 'report' && (mine ? <AthleteReport athleteId={id!} programs={shared} records={records} /> : <Spinner />)}
      {tab === 'records' && <RecordsList records={records} nameOf={nameOf} editable={false} />}
      {tab === 'access' && (
        <div className="flex flex-col gap-4">
          {admin && member.id !== session?.user.id && !member.is_app_owner && (
            <Card>
              <h2 className="mb-2 font-semibold">Rôle</h2>
              <div className="grid grid-cols-3 rounded-xl bg-zinc-800 p-1 text-sm">
                {(['athlete', 'coach', 'admin'] as const).map((r) => {
                  const current = (member.is_admin ? 'admin' : member.role) === r
                  return (
                    <button
                      key={r}
                      disabled={current}
                      className={`rounded-lg py-2 font-semibold ${current ? 'bg-zinc-950 text-lime-400' : 'text-zinc-400'}`}
                      onClick={() => setRole(r)}
                    >
                      {{ athlete: 'Athlète', coach: 'Coach', admin: 'Admin' }[r]}
                    </button>
                  )
                })}
              </div>
            </Card>
          )}
          <Card>
            <h2 className="mb-2 font-semibold">Mes programmations</h2>
            {programs.length === 0 && <p className="text-sm text-zinc-400">Tu n’as aucune programmation.</p>}
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
          {allPrograms.some((p) => !programs.some((mp) => mp.id === p.id)) && (
            <Card>
              <h2 className="mb-2 font-semibold">Autres programmations</h2>
              <p className="text-sm text-zinc-300">
                {allPrograms
                  .filter((p) => !programs.some((mp) => mp.id === p.id))
                  .map((p) => p.name)
                  .join(', ')}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Gérées par d’autres coachs.</p>
            </Card>
          )}

          <ErrorText>{error}</ErrorText>
          {admin && member.id !== session?.user.id && !member.is_app_owner && (
            <button className="py-2 text-sm text-red-400 underline" onClick={removeAccess}>
              Retirer l’accès à l’application
            </button>
          )}
        </div>
      )}
    </>
  )
}

function translate(message: string) {
  if (message.includes('last_admin')) return 'C’est le dernier admin : nomme d’abord un autre admin.'
  if (message.includes('app_owner')) return 'Le propriétaire de l’application ne peut pas être modifié.'
  if (message.includes('forbidden')) return 'Action réservée aux admins.'
  return message
}
