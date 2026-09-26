import { useCallback, useEffect, useState } from 'react'
import { Button, Card, ErrorText, PageTitle } from '../../components/ui'
import { invitationStatus, invitationUrl } from '../../domain/invitations'
import { supabase, type Invitation, type Profile } from '../../lib/supabase'

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

export function AthletesPage() {
  const [members, setMembers] = useState<Profile[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
      supabase.from('profiles').select('*').not('role', 'is', null).order('display_name'),
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
    ])
    setError(m.error?.message ?? i.error?.message ?? '')
    setMembers(m.data ?? [])
    setInvitations((i.data ?? []).filter((inv) => invitationStatus(inv) === 'active'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create(role: 'athlete' | 'coach') {
    // Athlete links are reusable for 7 days; coach links are single-use.
    const { error } = await supabase.from('invitations').insert({ role, max_uses: role === 'coach' ? 1 : null })
    if (error) setError(error.message)
    load()
  }

  async function revoke(id: string) {
    const { error } = await supabase.from('invitations').update({ revoked_at: new Date().toISOString() }).eq('id', id)
    if (error) setError(error.message)
    load()
  }

  async function share(inv: Invitation) {
    const url = invitationUrl(window.location.origin, inv.code)
    const text = inv.role === 'coach' ? 'Rejoins Tukiff Prog en tant que coach' : 'Rejoins Tukiff Prog'
    if (navigator.share) {
      await navigator.share({ title: 'Tukiff Prog', text, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(inv.id)
    }
  }

  return (
    <>
      <PageTitle>Athlètes</PageTitle>
      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="mb-3 font-semibold">Inviter</h2>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => create('athlete')}>
              Lien athlète
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => create('coach')}>
              Lien coach
            </Button>
          </div>
          {invitations.length > 0 && (
            <ul className="mt-4 flex flex-col gap-3">
              {invitations.map((inv) => (
                <li key={inv.id} className="rounded-xl border border-zinc-800 p-3">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">{inv.role === 'coach' ? 'Coach (usage unique)' : 'Athlète'}</span>
                    <span className="text-zinc-400">
                      expire le {dateFmt.format(new Date(inv.expires_at))} · {inv.uses} utilisé
                      {inv.uses > 1 ? 's' : ''}
                    </span>
                  </div>
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
          <h2 className="mb-3 font-semibold">Membres ({members.length})</h2>
          <ul className="divide-y divide-zinc-800">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <span>{m.display_name ?? '—'}</span>
                <span className="text-xs text-zinc-400">
                  {m.role === 'coach' ? 'Coach' : 'Athlète'}
                  {m.share_scores ? ' · scores partagés' : ''}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <ErrorText>{error}</ErrorText>
      </div>
    </>
  )
}
