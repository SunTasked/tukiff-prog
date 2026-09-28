import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Card, ErrorText, PageTitle } from '../../components/ui'
import { invitationStatus, invitationUrl, invitationValues, type InvitationValidity } from '../../domain/invitations'
import { supabase, type Invitation, type Profile, type Program } from '../../lib/supabase'
import { isAdmin, roleLabel, useAuth } from '../auth/AuthProvider'

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

type InvitationRow = Invitation & { invitation_programs: { program_id: string }[] }
type ProgramRow = Program & { program_members: { count: number }[]; program_coaches: { coach_id: string }[] }

export function AthletesPage() {
  const { session, profile } = useAuth()
  const me = session?.user.id
  const admin = isAdmin(profile)
  const [allPrograms, setAllPrograms] = useState<ProgramRow[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [programs, setPrograms] = useState<ProgramRow[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [role, setRole] = useState<'athlete' | 'coach'>('athlete')
  const [invitePrograms, setInvitePrograms] = useState<string[]>([])
  const [newProgram, setNewProgram] = useState('')

  const load = useCallback(async () => {
    const [m, i, p] = await Promise.all([
      supabase.from('profiles').select('*').not('role', 'is', null).order('display_name'),
      supabase.from('invitations').select('*, invitation_programs(program_id)').order('created_at', { ascending: false }),
      supabase.from('programs').select('*, program_members(count), program_coaches(coach_id)').is('archived_at', null).order('name'),
    ])
    setError(m.error?.message ?? i.error?.message ?? p.error?.message ?? '')
    setMembers(m.data ?? [])
    setInvitations(((i.data ?? []) as InvitationRow[]).filter((inv) => invitationStatus(inv) === 'active'))
    setAllPrograms((p.data ?? []) as ProgramRow[])
    // Only the programs I own or contribute to.
    setPrograms(
      ((p.data ?? []) as ProgramRow[]).filter((x) => x.owner_id === me || x.program_coaches.some((c) => c.coach_id === me)),
    )
  }, [me])

  useEffect(() => {
    load()
  }, [load])

  const programName = (id: string) => programs.find((p) => p.id === id)?.name ?? '?'

  async function create(validity: InvitationValidity) {
    const { data, error } = await supabase
      .from('invitations')
      .insert({ role, ...invitationValues(validity) })
      .select()
      .single()
    if (error) return setError(error.message)
    if (invitePrograms.length) {
      const res = await supabase
        .from('invitation_programs')
        .insert(invitePrograms.map((program_id) => ({ invitation_id: data.id, program_id })))
      if (res.error) setError(res.error.message)
    }
    load()
  }

  async function revoke(id: string) {
    const { error } = await supabase.from('invitations').update({ revoked_at: new Date().toISOString() }).eq('id', id)
    if (error) setError(error.message)
    load()
  }

  async function createProgram(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('programs').insert({ name: newProgram.trim() })
    if (error) return setError(error.code === '23505' ? 'Une programmation porte déjà ce nom.' : error.message)
    setNewProgram('')
    load()
  }

  async function share(inv: Invitation) {
    const url = invitationUrl(window.location.origin, inv.code)
    const text = inv.role === 'coach' ? `Rejoins ${import.meta.env.VITE_APP_NAME} en tant que coach` : `Rejoins ${import.meta.env.VITE_APP_NAME}`
    if (navigator.share) {
      await navigator.share({ title: import.meta.env.VITE_APP_NAME, text, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(inv.id)
    }
  }

  const toggleInviteProgram = (id: string) =>
    setInvitePrograms((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  return (
    <>
      <PageTitle>{admin ? 'Membres' : 'Athlètes'}</PageTitle>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start">
        <Card>
          <h2 className="mb-3 font-semibold">Inviter</h2>
          {admin && (
            <div className="mb-3 grid grid-cols-2 rounded-xl bg-zinc-800 p-1 text-sm">
              {(['athlete', 'coach'] as const).map((r) => (
                <button
                  key={r}
                  className={`rounded-lg py-2 font-semibold ${role === r ? 'bg-zinc-950 text-lime-400' : 'text-zinc-400'}`}
                  onClick={() => setRole(r)}
                >
                  {r === 'athlete' ? 'Athlète' : 'Coach'}
                </button>
              ))}
            </div>
          )}
          {programs.length > 0 && (
            <>
              <p className="mb-1 text-xs text-zinc-500">Accès aux programmations</p>
              <div className="mb-3 flex flex-wrap gap-1">
                {programs.map((p) => (
                  <button
                    key={p.id}
                    className={`rounded-full px-3 py-1.5 text-sm ${
                      invitePrograms.includes(p.id) ? 'bg-lime-400 font-semibold text-zinc-950' : 'bg-zinc-800 text-zinc-300'
                    }`}
                    onClick={() => toggleInviteProgram(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => create('single')}>
              Usage unique
            </Button>
            {role === 'athlete' && (
              <Button variant="secondary" className="flex-1" onClick={() => create('day')}>
                Valable 24 h
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Usage unique : 1 personne, valable 7 jours.{role === 'athlete' && ' 24 h : plusieurs personnes.'}
            {role === 'coach' && ' Les liens coach sont toujours à usage unique.'}
          </p>
          {invitations.length > 0 && (
            <ul className="mt-4 flex flex-col gap-3">
              {invitations.map((inv) => (
                <li key={inv.id} className="rounded-xl border border-zinc-800 p-3">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">
                      {inv.role === 'coach' ? 'Coach' : 'Athlète'} · {inv.max_uses === 1 ? 'usage unique' : '24 h'}
                    </span>
                    <span className="text-zinc-400">
                      expire le {dateFmt.format(new Date(inv.expires_at))} · {inv.uses} utilisé
                      {inv.uses > 1 ? 's' : ''}
                    </span>
                  </div>
                  {inv.invitation_programs.length > 0 && (
                    <p className="mt-1 text-xs text-zinc-400">
                      Programmes : {inv.invitation_programs.map((ip) => programName(ip.program_id)).join(', ')}
                    </p>
                  )}
                  <p className="mt-1 truncate font-mono text-xs text-zinc-500">
                    {invitationUrl(window.location.origin, inv.code)}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" className="flex-1 py-2 text-sm" onClick={() => share(inv)}>
                      {copied === inv.id ? 'Copié !' : 'Partager'}
                    </Button>
                    <Button variant="danger" className="py-2 text-sm" onClick={() => revoke(inv.id)}>
                      Révoquer
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Mes programmations ({programs.length})</h2>
          <ul className="divide-y divide-zinc-800">
            {programs.map((p) => (
              <li key={p.id}>
                <Link to={`/programs/${p.id}`} className="flex justify-between py-2">
                  <span>
                    {p.name}
                    {p.owner_id !== me && <span className="ml-1 text-xs text-zinc-500">(contributeur)</span>}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {p.program_members[0]?.count ?? 0} athlète{(p.program_members[0]?.count ?? 0) > 1 ? 's' : ''} ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <form onSubmit={createProgram} className="mt-2 flex gap-2">
            <input
              placeholder="Nouvelle programmation"
              maxLength={60}
              required
              className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 outline-none focus:border-lime-400"
              value={newProgram}
              onChange={(e) => setNewProgram(e.target.value)}
            />
            <Button className="py-2">Créer</Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Membres ({members.length})</h2>
          <ul className="divide-y divide-zinc-800">
            {members.map((m) => (
              <li key={m.id}>
                <Link to={`/athletes/${m.id}`} className="flex items-center justify-between py-2">
                  <span>{m.display_name ?? '—'}</span>
                  <span className="text-xs text-zinc-400">
                    {roleLabel(m)} ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        {admin && (
          <Card>
            <h2 className="mb-1 font-semibold">Toutes les programmations</h2>
            <p className="mb-2 text-xs text-zinc-500">Vue admin : nom et propriétaire.</p>
            <ul className="divide-y divide-zinc-800">
              {allPrograms.map((p) => (
                <li key={p.id} className="flex justify-between gap-2 py-2 text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-zinc-400">
                    {members.find((m) => m.id === p.owner_id)?.display_name ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </>
  )
}
