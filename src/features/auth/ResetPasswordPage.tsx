import { useState, type FormEvent } from 'react'
import { PasswordFields } from '../../components/PasswordFields'
import { Button, Centered, ErrorText } from '../../components/ui'
import { isValidPassword } from '../../domain/password'
import { supabase } from '../../lib/supabase'

/** New password form, used after a "forgotten password" link and from the profile. */
export function PasswordForm({ onDone, submitLabel }: { onDone: () => void; submitLabel: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!isValidPassword(password)) return setError('Le mot de passe ne respecte pas les règles.')
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } })
    setBusy(false)
    if (error) {
      setError(/different from the old/i.test(error.message) ? 'Choisis un mot de passe différent de l’ancien.' : error.message)
      return
    }
    setPassword('')
    setConfirm('')
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <PasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
      <Button disabled={busy}>{submitLabel}</Button>
      <ErrorText>{error}</ErrorText>
    </form>
  )
}

export function ResetPasswordPage({ onDone }: { onDone: () => void }) {
  return (
    <Centered>
      <h1 className="text-2xl font-bold">Nouveau mot de passe</h1>
      <PasswordForm onDone={onDone} submitLabel="Enregistrer" />
    </Centered>
  )
}
