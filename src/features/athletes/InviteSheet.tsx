import { useState } from 'react'
import { Button, ErrorText } from '../../components/ui'
import { invitationUrl, invitationValues, type InvitationValidity } from '../../domain/invitations'
import { supabase, type Invitation, type Program } from '../../lib/supabase'

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

export type InvitationRow = Invitation & { invitation_programs: { program_id: string }[] }

/** Invitation link generation for one role: program access, validity, and the active links of that role. */
export function InviteSheet({
  role,
  programs,
  invitations,
  onChange,
  onClose,
}: {
  role: 'athlete' | 'coach'
  programs: Program[]
  invitations: InvitationRow[]
  onChange: () => void
  onClose: () => void
}) {
  const [invitePrograms, setInvitePrograms] = useState<string[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')
  const links = invitations.filter((inv) => inv.role === role)
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
    onChange()
  }

  async function revoke(id: string) {
    const { error } = await supabase.from('invitations').update({ revoked_at: new Date().toISOString() }).eq('id', id)
    if (error) setError(error.message)
    onChange()
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
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 pt-[env(safe-area-inset-top)] lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black">
      <div className="flex items-center justify-between border-b border-zinc-800 p-3">
        <span className="font-semibold">{role === 'coach' ? 'Inviter un coach' : 'Inviter des athlètes'}</span>
        <button className="px-2 text-zinc-400" onClick={onClose}>
          Fermer
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
        <ErrorText>{error}</ErrorText>
        {links.length > 0 && (
          <>
            <h3 className="mt-5 mb-2 text-sm font-semibold text-zinc-400">Liens actifs ({links.length})</h3>
            <ul className="flex flex-col gap-3">
              {links.map((inv) => (
                <li key={inv.id} className="rounded-xl border border-zinc-800 p-3">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">{inv.max_uses === 1 ? 'Usage unique' : '24 h'}</span>
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
          </>
        )}
      </div>
    </div>
  )
}
