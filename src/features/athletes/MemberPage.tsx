import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Card, Chips, ErrorText, PageTitle, Spinner } from '../../components/ui'
import { formatDateTime } from '../../domain/dates'
import { fullName } from '../../domain/profile'
import { levelName, type AccessLevel } from '../../domain/workout'
import { supabase, type Profile } from '../../lib/supabase'
import { isAdmin, roleLabel, useAuth } from '../auth/AuthProvider'
import { useMyPrograms } from '../programs/useMyPrograms'
import { useExercises } from '../exercises/useExercises'
import { RecordsList } from '../records/RecordsList'
import { useRecords } from '../records/useRecords'
import { AthleteReport } from './AthleteReport'

const signupFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const TABS = { report: 'Compte rendu', access: 'Accès', records: 'Records' }

/** Member detail (coach): report on my programs, programs the member has access to, records. */
export function MemberPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, profile: me } = useAuth()
  const admin = isAdmin(me)
  const { programs: mine } = useMyPrograms()
  const programs = mine ?? []
  const { nameOf, measureOf } = useExercises()
  const { records } = useRecords(id)
  const [member, setMember] = useState<Profile | null>(null)
  const [programIds, setProgramIds] = useState<string[]>([])
  // Access level per program followed (0 = Free, 1 = Premium).
  const [levels, setLevels] = useState<Map<string, number>>(new Map())
  const [levelNames, setLevelNames] = useState<Map<string, AccessLevel[]>>(new Map())
  const [allPrograms, setAllPrograms] = useState<{ id: string; name: string }[]>([])
  const [email, setEmail] = useState<string | null>(null)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<keyof typeof TABS>('report')
  // Report: only the programs I edit that the member follows.
  const shared = useMemo(
    () =>
      (mine ?? []).filter((p) => programIds.includes(p.id)).map((p) => ({ id: p.id, name: p.name, level: levels.get(p.id) ?? 0 })),
    [mine, programIds, levels],
  )

  const load = useCallback(async () => {
    const [m, pm, seen] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id!).single(),
      supabase.from('program_members').select('program_id, level, programs(name, archived_at, access_levels)').eq('user_id', id!),
      supabase.rpc('members_last_seen'),
    ])
    setMember(m.data)
    setLastSeen(seen.data?.find((r) => r.user_id === id)?.last_at ?? null)
    setProgramIds((pm.data ?? []).map((r) => r.program_id))
    setLevels(new Map((pm.data ?? []).map((r) => [r.program_id, r.level])))
    setLevelNames(new Map((pm.data ?? []).map((r) => [r.program_id, (r.programs?.access_levels ?? []) as AccessLevel[]])))
    setAllPrograms(
      (pm.data ?? []).flatMap((r) => (r.programs && !r.programs.archived_at ? [{ id: r.program_id, name: r.programs.name }] : [])),
    )
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Emails are readable by admins only (checked server-side).
  useEffect(() => {
    if (!admin || !id) return
    supabase.rpc('member_email', { p_user: id }).then(({ data }) => setEmail(data ?? null))
  }, [admin, id])

  if (!member) return <Spinner />

  async function toggle(programId: string) {
    const { error } = programIds.includes(programId)
      ? await supabase.from('program_members').delete().eq('program_id', programId).eq('user_id', id!)
      : await supabase.from('program_members').insert({ program_id: programId, user_id: id! })
    setError(error?.message ?? '')
    load()
  }

  async function setLevel(programId: string, level: number) {
    const { error } = await supabase.from('program_members').update({ level }).eq('program_id', programId).eq('user_id', id!)
    setError(error?.message ?? '')
    load()
  }

  async function setRole(role: 'athlete' | 'coach' | 'admin') {
    const label = { athlete: 'athlète', coach: 'coach', admin: 'admin' }[role]
    const warning =
      role === 'athlete' && member!.role === 'coach' ? '\nSes programmations te seront transférées.' : ''
    if (!confirm(`Passer ${fullName(member)} en ${label} ?${warning}`)) return
    const { error } = await supabase.rpc('set_member_role', { p_user: id!, p_role: role })
    setError(error ? translate(error.message) : '')
    load()
  }

  async function removeAccess() {
    if (!confirm(`Retirer l’accès de ${fullName(member)} ? Il pourra être réinvité.`)) return
    const { error } = await supabase.rpc('remove_member', { p_user: id! })
    if (error) setError(translate(error.message))
    else navigate('/athletes')
  }

  return (
    <>
      <Link to="/athletes" className="text-sm text-zinc-400">
        ‹ Communauté
      </Link>
      <PageTitle>{fullName(member)}</PageTitle>
      {admin && email && <p className="-mt-3 mb-1 text-sm break-all text-zinc-300">{email}</p>}
      <p className={`${admin && email ? '' : '-mt-3 '}mb-4 text-sm text-zinc-400`}>
        {roleLabel(member)}
        {member.is_app_owner ? ' · propriétaire de l’app' : ''}
      </p>
      <p className="-mt-3 mb-4 text-xs text-zinc-500">
        Inscrit le {signupFmt.format(new Date(member.created_at))}
        <br />
        Dernier accès : {lastSeen ? formatDateTime(lastSeen) : 'inconnu'}
      </p>
      <div className="mb-4">
        <Chips options={TABS} value={tab} onChange={setTab} />
      </div>
      {tab === 'report' && (mine ? <AthleteReport athleteId={id!} programs={shared} records={records} /> : <Spinner />)}
      {tab === 'records' && <RecordsList records={records} nameOf={nameOf} measureOf={measureOf} linked={false} />}
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
                    <span className="flex-1">{p.name}</span>
                    {programIds.includes(p.id) && (levelNames.get(p.id)?.length ?? 0) > 0 && (
                      <select
                        aria-label="Niveau d’accès"
                        className="max-w-[45%] shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm"
                        value={levels.get(p.id) ?? 0}
                        onChange={(e) => setLevel(p.id, Number(e.target.value))}
                      >
                        {Array.from({ length: (levelNames.get(p.id)?.length ?? 0) + 1 }, (_, level) => (
                          <option key={level} value={level}>
                            {levelName(levelNames.get(p.id), level)}
                          </option>
                        ))}
                      </select>
                    )}
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
