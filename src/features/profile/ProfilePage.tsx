import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { programColor } from '../../components/ProgramBadges'
import { Button, Card, ErrorText, Input, PageTitle } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { PasswordForm } from '../auth/ResetPasswordPage'

export function ProfilePage() {
  const { session, profile, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [programs, setPrograms] = useState<string[] | null>(null)

  useEffect(() => {
    if (!session) return
    supabase
      .from('program_members')
      .select('programs(name, archived_at)')
      .eq('user_id', session.user.id)
      .then(({ data }) =>
        setPrograms(
          (data ?? [])
            .flatMap((r) => (r.programs && !r.programs.archived_at ? [r.programs.name] : []))
            .sort((a, b) => a.localeCompare(b)),
        ),
      )
  }, [session])

  async function update(values: { display_name?: string; share_scores?: boolean }) {
    setError('')
    setSaved(false)
    const { error } = await supabase.from('profiles').update(values).eq('id', profile!.id)
    if (error) return setError(error.message)
    await refreshProfile()
    setSaved(true)
  }

  async function deleteAccount() {
    if (!confirm('Supprimer définitivement ton compte et tous tes scores ? Cette action est irréversible.')) return
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setError(error.message.includes('last_coach') ? 'Tu es le seul coach : nomme un autre coach avant de supprimer ton compte.' : error.message)
      return
    }
    await supabase.auth.signOut()
  }

  const saveName = (e: FormEvent) => {
    e.preventDefault()
    update({ display_name: name.trim() })
  }

  return (
    <>
      <PageTitle>Profil</PageTitle>
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <Row label="Email">{session?.user.email}</Row>
          <Row label="Pseudo">{profile?.display_name}</Row>
          <Row label="Rôle">{profile?.role === 'coach' ? 'Coach' : 'Athlète'}</Row>
          <Row label="Programmes">
            {programs === null ? (
              '…'
            ) : programs.length === 0 ? (
              <span className="text-zinc-500">Aucun programme</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {programs.map((name) => (
                  <span key={name} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${programColor(name)}`}>
                    {name}
                  </span>
                ))}
              </span>
            )}
          </Row>
        </Card>

        <Section title="Records">
          <Link to="/records" className="flex items-center justify-between rounded-2xl bg-zinc-900 p-4">
            <span className="font-semibold">Mes records</span>
            <span className="text-zinc-400">1RM, benchmarks ›</span>
          </Link>
        </Section>

        <Section title="Modifier mon pseudo">
          <Card>
            <form onSubmit={saveName} className="flex flex-col gap-3">
              <Input label="Pseudo (visible par le groupe)" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
              <Button variant="secondary">Enregistrer</Button>
            </form>
          </Card>
        </Section>

        <Section title="Confidentialité">
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
        </Section>

        <Section title="Sécurité">
        <Card>
          <details>
            <summary className="cursor-pointer">Changer mon mot de passe</summary>
            <div className="mt-3">
              <PasswordForm submitLabel="Changer le mot de passe" onDone={() => setSaved(true)} />
            </div>
          </details>
        </Card>
        </Section>

        {saved && <p className="text-sm text-lime-400">Enregistré.</p>}
        <ErrorText>{error}</ErrorText>

        <SectionTitle>Compte</SectionTitle>
        <Button variant="secondary" onClick={() => supabase.auth.signOut()}>
          Se déconnecter
        </Button>
        <button className="py-2 text-sm text-red-400 underline" onClick={deleteAccount}>
          Supprimer mon compte
        </button>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="-mb-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">{children}</h2>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  )
}
