import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { Button, Card, ErrorText, PageTitle } from '../../components/ui'
import { seenAgo } from '../../domain/dates'
import { invitationStatus } from '../../domain/invitations'
import { fullName, isPending } from '../../domain/profile'
import { supabase, type Profile, type Program } from '../../lib/supabase'
import { isAdmin, isCoach, roleLabel, useAuth } from '../auth/AuthProvider'
import { InviteSheet, type InvitationRow } from './InviteSheet'

type ProgramRow = Program & { program_members: { count: number }[]; program_coaches: { coach_id: string }[] }

type MemberRow = Profile & { invitations: { label: string | null } | null }

const byName = (a: Profile, b: Profile) => fullName(a).localeCompare(fullName(b), 'fr', { sensitivity: 'base' })
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const yearFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
const shortDate = (ts: string) =>
  (new Date(ts).getFullYear() === new Date().getFullYear() ? dateFmt : yearFmt).format(new Date(ts))

type SortKey = 'name' | 'signup' | 'seen'
const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: 'name', label: 'Nom', className: 'flex-1 text-left' },
  { key: 'signup', label: 'Inscrit', className: 'w-16 text-right' },
  { key: 'seen', label: 'Vu', className: 'w-14 text-right' },
]

export function AthletesPage() {
  const { session, profile } = useAuth()
  const me = session?.user.id
  const admin = isAdmin(profile)
  const [allPrograms, setAllPrograms] = useState<ProgramRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [signups, setSignups] = useState<MemberRow[]>([])
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [programs, setPrograms] = useState<ProgramRow[]>([])
  const [error, setError] = useState('')
  const [inviting, setInviting] = useState<'athlete' | 'coach' | null>(null)
  const [newProgram, setNewProgram] = useState('')
  const [lastSeen, setLastSeen] = useState<Map<string, string | null>>(new Map())
  // Name A→Z by default; dates most recent first on first tap. Tapping the active column flips the order.
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'name', desc: false })

  const load = useCallback(async () => {
    const [m, i, p, s] = await Promise.all([
      supabase.from('profiles').select('*, invitations!profiles_invitation_id_fkey(label)').not('role', 'is', null),
      supabase.from('invitations').select('*, invitation_programs(program_id, level)').order('created_at', { ascending: false }),
      supabase.from('programs').select('*, program_members(count), program_coaches(coach_id)').is('archived_at', null).order('name'),
      supabase.rpc('members_last_seen'),
    ])
    setLastSeen(new Map((s.data ?? []).map((r) => [r.user_id, r.last_at])))
    setError(m.error?.message ?? i.error?.message ?? p.error?.message ?? '')
    const rows = (m.data ?? []) as MemberRow[]
    setMembers(rows.filter((r) => !isPending(r)))
    setSignups(rows.filter(isPending).sort((a, b) => b.created_at.localeCompare(a.created_at)))
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

  async function deleteSignup(m: MemberRow) {
    if (!confirm(`Supprimer l’inscription en cours « ${m.invitations?.label ?? 'lien sans nom'} » ? Un lien à usage unique redevient utilisable.`)) return
    const { error } = await supabase.rpc('delete_pending_member', { p_user: m.id })
    setError(error?.message ?? '')
    load()
  }

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
  const sorted = (list: Profile[]) => {
    if (sort.key === 'name') return sort.desc ? [...list].reverse() : list
    const value = (m: Profile) => (sort.key === 'signup' ? m.created_at : lastSeen.get(m.id)) ?? ''
    // Never seen: always at the end.
    return [...list].sort((a, b) => {
      const [x, y] = [value(a), value(b)]
      if (!x || !y) return (x ? 0 : 1) - (y ? 0 : 1)
      return sort.desc ? y.localeCompare(x) : x.localeCompare(y)
    })
  }
  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' }))

  const owned = allPrograms.filter((p) => p.owner_id === me)
  const contributed = programs.filter((p) => p.owner_id !== me)
  const others = allPrograms.filter((p) => p.owner_id !== me && !programs.includes(p))
  const ownerName = (p: ProgramRow) => fullName(members.find((m) => m.id === p.owner_id))

  const programGroup = (title: string, list: ProgramRow[], linked: boolean) => (
    <section>
      <h3 className="text-sm font-semibold text-zinc-400">
        {title} ({list.length})
      </h3>
      <ul className="mt-1 divide-y divide-zinc-800">
        {list.map((p) => {
          const count = p.program_members[0]?.count ?? 0
          const content = (
            <>
              <span className="min-w-0 truncate">
                {p.name}
                {p.owner_id !== me && <span className="ml-1 text-xs text-zinc-500">· {ownerName(p)}</span>}
              </span>
              <span className="shrink-0 text-xs text-zinc-400">
                {count} athlète{count > 1 ? 's' : ''}
                {linked && ' ›'}
              </span>
            </>
          )
          return (
            <li key={p.id}>
              {linked ? (
                <Link to={`/programs/${p.id}`} className="flex justify-between gap-2 py-2">
                  {content}
                </Link>
              ) : (
                <div className="flex justify-between gap-2 py-2">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )

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
      {list.length > 0 && (
        <div className="mt-2 flex gap-2 border-b border-zinc-800 pb-1 pl-10 text-xs text-zinc-500">
          {COLUMNS.map((c) => (
            <button key={c.key} className={`${c.className} ${sort.key === c.key ? 'text-lime-400' : ''}`} onClick={() => sortBy(c.key)}>
              {c.label}
              {sort.key === c.key && (sort.desc ? ' ↓' : ' ↑')}
            </button>
          ))}
        </div>
      )}
      <ul className="divide-y divide-zinc-800">
        {sorted(list).map((m) => {
          const seen = lastSeen.get(m.id)
          return (
            <li key={m.id}>
              <Link to={`/athletes/${m.id}`} className="flex items-center gap-2 py-2">
                <Avatar url={m.avatar_url} name={fullName(m)} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5">
                    {m.gender && (
                      <span
                        className={`size-2 shrink-0 rounded-full ${m.gender === 'female' ? 'bg-pink-400' : 'bg-sky-400'}`}
                        aria-label={m.gender === 'female' ? 'Femme' : 'Homme'}
                      />
                    )}
                    <span className="truncate">{fullName(m)}</span>
                  </span>
                  {((m.first_name && m.display_name) || m.is_admin) && (
                    <span className="truncate text-xs text-zinc-500">
                      {[m.first_name && m.display_name, m.is_admin && roleLabel(m)].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                <span className="w-16 shrink-0 text-right text-xs text-zinc-400">{shortDate(m.created_at)}</span>
                <span className="w-14 shrink-0 text-right text-xs text-zinc-400">{seen ? seenAgo(seen) : '—'}</span>
              </Link>
            </li>
          )
        })}
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
          {signups.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-zinc-400">Inscriptions en cours ({signups.length})</h3>
              <p className="text-xs text-zinc-500">Lien utilisé mais inscription pas terminée. Supprimées après 7 jours.</p>
              <ul className="mt-1 divide-y divide-zinc-800">
                {signups.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate">
                      {m.invitations?.label ?? 'Lien sans nom'}
                      <span className="ml-1.5 text-xs text-zinc-500">
                        {m.role === 'coach' ? 'coach · ' : ''}le {dateFmt.format(new Date(m.created_at))}
                      </span>
                    </span>
                    <button className="shrink-0 text-sm text-red-400" onClick={() => deleteSignup(m)}>
                      Supprimer
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          {programGroup('Mes programmations', owned, true)}
          <form onSubmit={createProgram} className="-mt-2 flex gap-2">
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
          {contributed.length > 0 && (
            <>
              <hr className="border-zinc-700" />
              {programGroup('Contributeur', contributed, true)}
            </>
          )}
          {admin && others.length > 0 && (
            <>
              <hr className="border-zinc-700" />
              {programGroup('Autres programmations', others, false)}
            </>
          )}
        </Card>
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
