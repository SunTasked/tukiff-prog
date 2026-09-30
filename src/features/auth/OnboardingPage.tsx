import { useState, type FormEvent } from 'react'
import { PasswordFields } from '../../components/PasswordFields'
import { Button, Centered, Chips, ErrorText, Input } from '../../components/ui'
import { isValidPassword } from '../../domain/password'
import { GENDERS, type Gender } from '../../domain/profile'
import { supabase } from '../../lib/supabase'
import { hasPassword, useAuth } from './AuthProvider'

/** First sign-in (via magic link): first and last name, a nickname, a gender (for the leaderboards) and a password. */
export function OnboardingPage() {
  const { session, profile, refreshProfile, refreshSession } = useAuth()
  const needsPassword = !hasPassword(session)
  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  const [lastName, setLastName] = useState(profile?.last_name ?? '')
  const [name, setName] = useState(profile?.display_name ?? '')
  const [gender, setGender] = useState<Gender | null>((profile?.gender as Gender | null) ?? null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return setError('Indique ton prénom et ton nom.')
    if (!gender) return setError('Indique si tu es un homme ou une femme (pour les classements).')
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
    const { error } = await supabase.from('profiles').update({ first_name: firstName.trim(), last_name: lastName.trim(), display_name: name.trim(), gender }).eq('id', profile!.id)
    setBusy(false)
    if (error) return setError(error.message)
    await Promise.all([refreshProfile(), refreshSession()])
  }

  return (
    <Centered>
      <h1 className="text-2xl font-bold">Bienvenue !</h1>
      <p className="text-sm text-zinc-400">
        Indique ton prénom, ton nom, ton pseudo, ton genre{needsPassword && ' et un mot de passe : tu t’en serviras pour te reconnecter'}.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Prénom"
            required
            maxLength={40}
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            label="Nom"
            required
            maxLength={40}
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <Input
          label="Pseudo (visible par le groupe)"
          required
          maxLength={40}
          autoComplete="nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div>
          <span className="mb-1 block text-sm text-zinc-400">Genre (classements hommes / femmes)</span>
          <Chips options={GENDERS} value={gender} onChange={setGender} />
        </div>
        {needsPassword && (
          <PasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
        )}
        <Button disabled={busy}>Continuer</Button>
        <ErrorText>{error}</ErrorText>
      </form>
    </Centered>
  )
}
