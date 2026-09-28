import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { Button, Card, ErrorText, PageTitle } from '../../components/ui'
import { invitationStatus } from '../../domain/invitations'
import { supabase, type Profile, type Program } from '../../lib/supabase'
import { isAdmin, isCoach, roleLabel, useAuth } from '../auth/AuthProvider'
import { InviteSheet, type InvitationRow } from './InviteSheet'

type ProgramRow = Program & { program_members: { count: number }[]; program_coaches: { coach_id: string }[] }

const byName = (a: Profile, b: Profile) =>
  (a.display_name ?? '').localeCompare(b.display_name ?? '', 'fr', { sensitivity: 'base' })

export function AthletesPage() {
  const { session, profile } = useAuth()
  const me = session?.user.id
  const admin = isAdmin(profile)
  const [allPrograms, setAllPrograms] = useState<ProgramRow[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [programs, setPrograms] = useState<ProgramRow[]>([])
  const [error, setError] = useState('')
  const [inviting, setInviting] = useState<'athlete' | 'coach' | null>(null)
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

  async function createProgram(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('programs').insert({ name: newProgram.trim() })
    if (error) return setError(error.code === '23505' ? 'Une programmation porte déjà ce nom.' : error.message)
    setNewProgram('')
    load()
  }

  // Admins first, then coaches, then athletes; alphabetical within each group.
  const staff = [...members.filter(isAdmin).sort(byName), ...members.filter((m) => !isAdmin(m) && isCoach(m)).sort(byName)]
  const athletes = members.filter((m) => !isAdmin(m) && !isCoach(m)).sort(byName)
  const pending = (role: 'athlete' | 'coach') => invitations.filter((inv) => inv.role === role).length

  const group = (title: string, list: Profile[], role: 'athlete' | 'coach', canInvite: boolean) => (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-400">
          {title} ({list.length})
          {canInvite && pending(role) > 0 && (
            <span className="ml-2 font-normal text-zinc-500">
              · {pending(role)} lien{pending(role) > 1 ? 's' : ''} actif{pending(role) > 1 ? 's' : ''}
            </span>
          )}
        </h3>
        {canInvite && (
          <button
            className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-lime-400 text-xl leading-none font-semibold text-zinc-950"
            aria-label={role === 'coach' ? 'Inviter un coach' : 'Inviter des athlètes'}
            onClick={() => setInviting(role)}
          >
            +
          </button>
        )}
      </div>
      <ul className="mt-1 divide-y divide-zinc-800">
        {list.map((m) => (
          <li key={m.id}>
            <Link to={`/athletes/${m.id}`} className="flex items-center gap-3 py-2">
              <Avatar url={m.avatar_url} name={m.display_name} />
              <span className="min-w-0 flex-1 truncate">{m.display_name ?? '—'}</span>
              <span className="text-xs text-zinc-400">{m.is_admin ? `${roleLabel(m)} ›` : '›'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <>
      <PageTitle>Communauté</PageTitle>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <Card className="flex flex-col gap-4">
          {group('Coachs', staff, 'coach', admin)}
          <hr className="border-zinc-700" />
          {group('Athlètes', athletes, 'athlete', true)}
        </Card>

        <div className="flex flex-col gap-4">
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
        </div>
        <ErrorText>{error}</ErrorText>
      </div>
      {inviting && (
        <InviteSheet
          role={inviting}
          programs={programs}
          invitations={invitations}
          onChange={load}
          onClose={() => setInviting(null)}
        />
      )}
    </>
  )
}
