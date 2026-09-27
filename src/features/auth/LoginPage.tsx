import { useState, type FormEvent } from 'react'
import { Button, Centered, ErrorText, Input } from '../../components/ui'
import { supabase } from '../../lib/supabase'

function translate(message: string) {
  if (message === 'invalid_invitation') return 'Lien d’invitation invalide, expiré ou déjà utilisé.'
  if (/invalid login credentials/i.test(message)) return 'Email ou mot de passe incorrect.'
  if (/signups not allowed/i.test(message)) return 'Compte inconnu : demande un lien d’invitation à ton coach.'
  if (/rate limit|security purposes/i.test(message)) return 'Trop de demandes d’email. Réessaie dans un moment.'
  return message
}

type Mode = 'password' | 'forgot' | 'sent'

export function LoginPage({ inviteCode }: { inviteCode: string | null }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<Mode>('password')
  // Existing members opening an invitation (e.g. athlete promoted to coach) sign in with their password.
  const [existing, setExisting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(fn: () => Promise<{ error: { message: string } | null }>, next?: Mode) {
    setBusy(true)
    setError('')
    const { error } = await fn()
    setBusy(false)
    if (error) setError(translate(error.message))
    else if (next) setMode(next)
  }

  // Invitation: the join function creates the account, then a magic link is sent.
  // The link comes back to /join/<code> so the invitation is applied even in another browser.
  const join = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const { error } = await supabase.functions.invoke('join', { body: { code: inviteCode, email: email.trim() } })
      if (error) return { error: { message: 'invalid_invitation' } }
      return supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/join/${inviteCode}` },
      })
    }, 'sent')
  }

  const login = (e: FormEvent) => {
    e.preventDefault()
    run(() => supabase.auth.signInWithPassword({ email: email.trim(), password }))
  }

  const forgot = (e: FormEvent) => {
    e.preventDefault()
    run(
      () =>
        supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      'sent',
    )
  }

  const emailInput = (
    <Input
      label="Email"
      type="email"
      autoComplete="email"
      required
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />
  )

  return (
    <Centered>
      <h1 className="text-3xl font-bold">
        TKF <span className="text-lime-400">{import.meta.env.VITE_APP_NAME.replace(/^TKF /, '')}</span>
      </h1>

      {mode === 'sent' ? (
        <>
          <p className="text-zinc-300">
            Un email a été envoyé à <b>{email}</b>. Ouvre le lien qu’il contient pour continuer.
          </p>
          <button className="text-sm text-zinc-500 underline" onClick={() => setMode('password')}>
            Retour
          </button>
        </>
      ) : inviteCode && !existing ? (
        <form onSubmit={join} className="flex flex-col gap-3">
          <p className="text-zinc-300">Tu as été invité ! Saisis ton email pour recevoir un lien d’inscription.</p>
          {emailInput}
          <Button disabled={busy}>Recevoir le lien</Button>
          <button type="button" className="text-sm text-zinc-500 underline" onClick={() => setExisting(true)}>
            Déjà un compte ? Se connecter
          </button>
        </form>
      ) : mode === 'forgot' ? (
        <form onSubmit={forgot} className="flex flex-col gap-3">
          <p className="text-zinc-300">Saisis ton email : tu recevras un lien pour choisir un nouveau mot de passe.</p>
          {emailInput}
          <Button disabled={busy}>Envoyer le lien</Button>
          <button type="button" className="text-sm text-zinc-500 underline" onClick={() => setMode('password')}>
            Retour
          </button>
        </form>
      ) : (
        <form onSubmit={login} className="flex flex-col gap-3">
          {emailInput}
          <Input
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button disabled={busy}>Se connecter</Button>
          <button type="button" className="text-sm text-zinc-500 underline" onClick={() => setMode('forgot')}>
            Mot de passe oublié ?
          </button>
        </form>
      )}

      <ErrorText>{error}</ErrorText>
    </Centered>
  )
}
