import { useEffect, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { Chips } from '../../components/ui'
import { GENDERS, fullName, scoreName, type Gender } from '../../domain/profile'
import type { TeamGuest } from '../../domain/scoring'
import { supabase } from '../../lib/supabase'

export type Teammate = {
  id: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  gender: Gender | null
  avatar_url: string | null
}

/** Max people in a team, whatever the block's team size (an odd number in class makes a team of 3 on a WOD by 2). */
const MAX_TEAM = 4

/** My teammates on a team block: program members who can score it, or guests without an account (name + gender). */
export function TeamPicker({
  blockId,
  size,
  members,
  guests,
  onChange,
}: {
  blockId: string
  size: number
  members: Teammate[]
  guests: TeamGuest[]
  onChange: (members: Teammate[], guests: TeamGuest[]) => void
}) {
  const [candidates, setCandidates] = useState<Teammate[]>([])
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [guestGender, setGuestGender] = useState<Gender>('male')
  const count = 1 + members.length + guests.length

  useEffect(() => {
    supabase.rpc('team_candidates', { p_block: blockId }).then(({ data }) => setCandidates((data ?? []) as Teammate[]))
  }, [blockId])

  const q = query.trim().toLowerCase()
  const found = candidates
    .filter((c) => !members.some((m) => m.id === c.id))
    .filter((c) => !q || `${fullName(c)} ${c.display_name ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => scoreName(a).localeCompare(scoreName(b), 'fr'))
    .slice(0, 8)

  const add = (patch: { member?: Teammate; guest?: TeamGuest }) => {
    onChange(patch.member ? [...members, patch.member] : members, patch.guest ? [...guests, patch.guest] : guests)
    setQuery('')
    setAdding(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-zinc-400">
        Équipe · {count}/{size}
      </span>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300">Moi</span>
        {members.map((m) => (
          <button
            key={m.id}
            className="flex items-center gap-1.5 rounded-full bg-zinc-800 py-1 pr-2 pl-1 text-sm"
            onClick={() => onChange(members.filter((x) => x !== m), guests)}
          >
            <Avatar url={m.avatar_url} name={scoreName(m)} className="size-5 text-[9px]" />
            {scoreName(m)} <span className="text-zinc-500">✕</span>
          </button>
        ))}
        {guests.map((g, i) => (
          <button
            key={`g${i}`}
            className="rounded-full bg-zinc-800 px-3 py-1 text-sm"
            onClick={() => onChange(members, guests.filter((x) => x !== g))}
          >
            {g.name} <span className="text-zinc-500">(invité{g.gender === 'female' ? 'e' : ''}) ✕</span>
          </button>
        ))}
        {count < MAX_TEAM && !adding && (
          <button className="rounded-full border border-zinc-700 px-3 py-1 text-sm text-lime-400" onClick={() => setAdding(true)}>
            + Équipier
          </button>
        )}
      </div>
      {count !== size && !adding && (
        <p className="text-xs text-amber-400">
          Équipe de {count} sur un WOD par {size}.
        </p>
      )}
      {adding && (
        <div className="flex flex-col gap-1 rounded-xl border border-zinc-800 p-2">
          <input
            autoFocus
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-sm outline-none focus:border-lime-400"
            placeholder="Nom de l’équipier"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {found.map((c) => (
            <button key={c.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm" onClick={() => add({ member: c })}>
              <Avatar url={c.avatar_url} name={scoreName(c)} className="size-6 text-[10px]" />
              {fullName(c)}
            </button>
          ))}
          {q && (
            <div className="mt-1 flex items-center gap-2 border-t border-zinc-800 pt-2">
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-400">« {query.trim()} » sans compte :</span>
              <Chips options={GENDERS} value={guestGender} onChange={setGuestGender} />
            </div>
          )}
          <div className="flex gap-2">
            {q && (
              <button
                className="flex-1 rounded-lg bg-zinc-800 py-1.5 text-sm font-semibold"
                onClick={() => add({ guest: { name: query.trim().slice(0, 40), gender: guestGender } })}
              >
                Ajouter en invité
              </button>
            )}
            <button className="px-3 py-1.5 text-sm text-zinc-400" onClick={() => setAdding(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
