import { useState, type FormEvent } from 'react'
import { PasswordFields } from '../../components/PasswordFields'
import { Button, Centered, ErrorText, Input } from '../../components/ui'
import { isValidPassword } from '../../domain/password'
import { supabase } from '../../lib/supabase'
import { hasPassword, useAuth } from './AuthProvider'

/** First sign-in (via magic link): choose a nickname and a password. */
export function OnboardingPage() {
  const { session, profile, refreshProfile, refreshSession } = useAuth()
  const needsPassword = !hasPassword(session)
  const [name, setName] = useState(profile?.display_name ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (needsPassword && !isValidPassword(password)) return setError('Le mot de passe ne respecte pas les règles.')
    if (needsPassword && password !== confirm) return setError('Les mots de passe ne correspondent pas.')
    setBusy(true)
    setError('')
    if (needsPassword) {
      const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } })
      if (error) {
        setBusy(false)
        return setError(error.message)
      }
    }
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', profile!.id)
    setBusy(false)
    if (error) return setError(error.message)
    await Promise.all([refreshProfile(), refreshSession()])
  }

  return (
    <Centered>
      <h1 className="text-2xl font-bold">Bienvenue !</h1>
      <p className="text-sm text-zinc-400">
        Choisis ton pseudo{needsPassword && ' et un mot de passe : tu t’en serviras pour te reconnecter'}.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input
          label="Pseudo (visible par le groupe)"
          required
          maxLength={40}
          autoComplete="nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {needsPassword && (
          <PasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
        )}
        <Button disabled={busy}>Continuer</Button>
        <ErrorText>{error}</ErrorText>
      </form>
    </Centered>
  )
}
