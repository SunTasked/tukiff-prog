import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, Card, ErrorText, Input, PageTitle, Spinner } from '../../components/ui'
import { supabase, type Profile, type Program } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { fullName } from '../../domain/profile'
import { BASE_LEVEL, levelName, type AccessLevel } from '../../domain/workout'

/**
 * Program detail. Owner: rename, archive, contributor coaches, emoji reactions and leaderboard on/off. Owner + contributors: athletes with access.
 */
export function ProgramPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const me = session?.user.id
  const [program, setProgram] = useState<Program | null>(null)
  const [name, setName] = useState('')
  // Access levels above Base, being edited (saved together; a deletion is immediate).
  const [levels, setLevels] = useState<AccessLevel[] | null>(null)
  // Members and their access level.
  const [memberLevels, setMemberLevels] = useState<Map<string, number>>(new Map())
  const [coachIds, setCoachIds] = useState<string[]>([])
  const [everyone, setEveryone] = useState<Profile[]>([])
  const [error, setError] = useState('')
  const [heir, setHeir] = useState('')

  const load = useCallback(async () => {
    const [p, pm, pc, m] = await Promise.all([
      supabase.from('programs').select('*').eq('id', id!).single(),
      supabase.from('program_members').select('user_id, level').eq('program_id', id!),
      supabase.from('program_coaches').select('coach_id').eq('program_id', id!),
      supabase.from('profiles').select('*').not('role', 'is', null).order('first_name'),
    ])
    setProgram(p.data)
    setName((n) => n || p.data?.name || '')
    setLevels((l) => l ?? ((p.data?.access_levels ?? null) as AccessLevel[] | null))
    setMemberLevels(new Map((pm.data ?? []).map((r) => [r.user_id, r.level])))
    setCoachIds((pc.data ?? []).map((r) => r.coach_id))
    setEveryone(m.data ?? [])
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (!program) return <Spinner />
  const isOwner = program.owner_id === me
  const savedLevels = program.access_levels as AccessLevel[]
  const canEdit = isOwner || coachIds.includes(me ?? '')
  if (!canEdit) return <p className="text-zinc-400">Cette programmation est gérée par un autre coach.</p>

  const run = async (p: PromiseLike<{ error: { message: string; code?: string } | null }>) => {
    const { error } = await p
    setError(error ? (error.code === '23505' ? 'Une programmation porte déjà ce nom.' : error.message) : '')
    await load()
  }

  const toggleMember = (userId: string) =>
    run(
      memberLevels.has(userId)
        ? supabase.from('program_members').delete().eq('program_id', id!).eq('user_id', userId)
        : supabase.from('program_members').insert({ program_id: id!, user_id: userId }),
    )
  const setMemberLevel = (userId: string, level: number) =>
    run(supabase.from('program_members').update({ level }).eq('program_id', id!).eq('user_id', userId))
  const toggleCoach = (coachId: string) =>
    run(
      coachIds.includes(coachId)
        ? supabase.from('program_coaches').delete().eq('program_id', id!).eq('coach_id', coachId)
        : supabase.from('program_coaches').insert({ program_id: id!, coach_id: coachId }),
    )

  async function archive() {
    if (!confirm(`Archiver « ${program!.name} » ? Ses athlètes n’en verront plus les séances.`)) return
    await supabase.from('program_members').delete().eq('program_id', id!)
    const { error } = await supabase.from('programs').update({ archived_at: new Date().toISOString() }).eq('id', id!)
    if (error) setError(error.message)
    else navigate('/athletes')
  }

  const owner = everyone.find((p) => p.id === program.owner_id)
  const otherCoaches = everyone.filter((p) => p.role === 'coach' && p.id !== program.owner_id)
  const check = (checked: boolean, onChange: () => void, label: string, hint?: string, extra?: ReactNode) => (
    <label className="flex items-center gap-3 py-1.5">
      <input type="checkbox" className="size-5 accent-lime-400" checked={checked} onChange={onChange} />
      <span>{label}</span>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
      {extra}
    </label>
  )
  const levelSelect = (userId: string) => (
    <select
      aria-label="Niveau d’accès"
      className="ml-auto max-w-[45%] shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm"
      value={memberLevels.get(userId) ?? 0}
      onChange={(e) => setMemberLevel(userId, Number(e.target.value))}
    >
      {Array.from({ length: savedLevels.length + 1 }, (_, level) => (
        <option key={level} value={level}>
          {levelName(savedLevels, level)}
        </option>
      ))}
    </select>
  )

  return (
    <>
      <Link to="/athletes" className="text-sm text-zinc-400">
        ‹ Communauté
      </Link>
      <PageTitle>{program.name}</PageTitle>
      <p className="-mt-3 mb-4 text-sm text-zinc-400">
        Propriétaire : {isOwner ? 'toi' : fullName(owner)}
      </p>
      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="mb-2 font-semibold">Athlètes ({memberLevels.size})</h2>
          <ul>
            {everyone.map((m) => (
              <li key={m.id}>
                {check(
                  memberLevels.has(m.id),
                  () => toggleMember(m.id),
                  fullName(m),
                  m.role === 'coach' ? 'coach' : undefined,
                  memberLevels.has(m.id) && savedLevels.length > 0 ? levelSelect(m.id) : undefined,
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">Coachs contributeurs</h2>
          <p className="mb-2 text-xs text-zinc-500">Ils peuvent modifier les séances et les athlètes de cette programmation.</p>
          {otherCoaches.length === 0 && <p className="text-sm text-zinc-400">Aucun autre coach.</p>}
          <ul>
            {otherCoaches.map((c) => (
              <li key={c.id}>
                {isOwner ? (
                  check(coachIds.includes(c.id), () => toggleCoach(c.id), fullName(c))
                ) : (
                  <span className={`block py-1.5 ${coachIds.includes(c.id) ? '' : 'hidden'}`}>{fullName(c)}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>

        {isOwner && (
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
        )}
        {isOwner && (
          <Card>
            {check(
              program.reactions_enabled,
              () => run(supabase.from('programs').update({ reactions_enabled: !program.reactions_enabled }).eq('id', id!)),
              'Claps 👏 sur les scores',
            )}
            {check(
              program.leaderboard_enabled,
              () => run(supabase.from('programs').update({ leaderboard_enabled: !program.leaderboard_enabled }).eq('id', id!)),
              'Classement des scores',
            )}
            <p className="text-xs text-zinc-500">
              Décoché : claps masqués pour tous ; sans classement, chaque athlète ne voit que son score (les coachs voient tout).
            </p>
          </Card>
        )}
        {isOwner && levels && (
          <Card className="flex flex-col gap-3">
            <div>
              <h2 className="font-semibold">Niveaux d’accès</h2>
              <p className="text-xs text-zinc-500">
                Chaque athlète a un niveau (onglet Accès de sa fiche) et voit les blocs de son niveau et des niveaux en dessous.
                Aperçu : les blocs du niveau apparaissent grisés et verrouillés aux niveaux inférieurs ; sinon ils sont masqués.
              </p>
            </div>
            <p className="text-sm text-zinc-400">0 · {BASE_LEVEL} (tous les athlètes)</p>
            {levels.map((level, i) => {
              const set = (patch: Partial<AccessLevel>) => setLevels(levels.map((l, j) => (j === i ? { ...l, ...patch } : l)))
              const saved = i < savedLevels.length
              return (
                <div key={i} className="flex flex-col gap-1 rounded-xl border border-zinc-800 p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-400">{i + 1} ·</span>
                    <input
                      aria-label={`Nom du niveau ${i + 1}`}
                      maxLength={30}
                      placeholder="Nom du niveau"
                      className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 outline-none focus:border-lime-400"
                      value={level.name}
                      onChange={(e) => set({ name: e.target.value })}
                    />
                    <button
                      type="button"
                      aria-label={`Supprimer le niveau ${i + 1}`}
                      className="px-2 text-red-400"
                      onClick={() => {
                        if (!saved) return setLevels(levels.filter((_, j) => j !== i))
                        const below = i === 0 ? BASE_LEVEL : savedLevels[i - 1].name
                        if (!confirm(`Supprimer « ${savedLevels[i].name} » ? Ses blocs et ses athlètes passent au niveau « ${below} ».`)) return
                        setLevels(null)
                        run(supabase.rpc('delete_access_level', { p_program: id!, p_level: i + 1 }))
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <label className="flex items-center gap-2 pl-5 text-sm text-zinc-300">
                    <input type="checkbox" className="size-4 accent-lime-400" checked={level.preview} onChange={() => set({ preview: !level.preview })} />
                    Aperçu pour les niveaux inférieurs
                  </label>
                </div>
              )
            })}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={levels.length >= 9} onClick={() => setLevels([...levels, { name: '', preview: true }])}>
                + Niveau
              </Button>
              <Button
                disabled={levels.some((l) => !l.name.trim()) || JSON.stringify(levels) === JSON.stringify(savedLevels)}
                onClick={() => {
                  const next = levels.map((l) => ({ name: l.name.trim(), preview: l.preview }))
                  setLevels(null)
                  run(supabase.from('programs').update({ access_levels: next }).eq('id', id!))
                }}
              >
                Enregistrer
              </Button>
            </div>
          </Card>
        )}
        {isOwner && otherCoaches.length > 0 && (
          <Card className="flex flex-col gap-2">
            <h2 className="font-semibold">Transférer la propriété</h2>
            <p className="text-xs text-zinc-500">Le nouveau propriétaire prend la main ; tu restes contributeur.</p>
            <select className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2" value={heir} onChange={(e) => setHeir(e.target.value)}>
              <option value="">Choisir un coach…</option>
              {otherCoaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              disabled={!heir}
              onClick={() => {
                const name = fullName(otherCoaches.find((c) => c.id === heir))
                if (confirm(`Transférer « ${program.name} » à ${name} ?`))
                  run(supabase.rpc('transfer_program', { p_program: id!, p_new_owner: heir }))
              }}
            >
              Transférer
            </Button>
          </Card>
        )}
        <ErrorText>{error}</ErrorText>
        {isOwner && (
          <button className="py-2 text-sm text-red-400 underline" onClick={archive}>
            Archiver la programmation
          </button>
        )}
      </div>
    </>
  )
}
