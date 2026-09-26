import { useState, type FormEvent } from 'react'
import { Button, Card, ErrorText, Input, PageTitle } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

export function ProfilePage() {
  const { session, profile, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function update(values: { display_name?: string; share_scores?: boolean }) {
    setError('')
    setSaved(false)
    const { error } = await supabase.from('profiles').update(values).eq('id', profile!.id)
    if (error) return setError(error.message)
    await refreshProfile()
    setSaved(true)
  }

  const saveName = (e: FormEvent) => {
    e.preventDefault()
    update({ display_name: name.trim() })
  }

  return (
    <>
      <PageTitle>Profil</PageTitle>
      <div className="flex flex-col gap-4">
        <Card>
          <p className="text-sm text-zinc-400">{session?.user.email}</p>
          <p className="mt-1 text-sm">
            Rôle : <b className="text-lime-400">{profile?.role === 'coach' ? 'Coach' : 'Athlète'}</b>
          </p>
        </Card>

        <Card>
          <form onSubmit={saveName} className="flex flex-col gap-3">
            <Input label="Prénom" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
            <Button variant="secondary">Enregistrer</Button>
          </form>
        </Card>

        <Card>
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block">Partager mes scores</span>
              <span className="block text-sm text-zinc-400">Les autres athlètes voient mes résultats. Le coach les voit toujours.</span>
            </span>
            <input
              type="checkbox"
              className="size-6 accent-lime-400"
              checked={profile?.share_scores ?? false}
              onChange={(e) => update({ share_scores: e.target.checked })}
            />
          </label>
        </Card>

        {saved && <p className="text-sm text-lime-400">Enregistré.</p>}
        <ErrorText>{error}</ErrorText>

        <Button variant="danger" onClick={() => supabase.auth.signOut()}>
          Se déconnecter
        </Button>
      </div>
    </>
  )
}
