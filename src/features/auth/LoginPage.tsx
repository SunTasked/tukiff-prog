import { useState, type FormEvent } from 'react'
import { Button, Centered, ErrorText, Input } from '../../components/ui'
import { supabase } from '../../lib/supabase'

const devLogin = import.meta.env.VITE_DEV_LOGIN === '1'

function translate(message: string) {
  if (/signups not allowed/i.test(message)) return 'Compte inconnu : demande un lien d’invitation à ton coach.'
  if (/rate limit/i.test(message)) return 'Trop de demandes d’email. Réessaie dans un moment.'
  if (/expired|invalid/i.test(message)) return 'Code invalide ou expiré.'
  return message
}

export function LoginPage({ invited }: { invited: boolean }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(fn: () => Promise<{ error: { message: string } | null }>, next?: typeof step) {
    setBusy(true)
    setError('')
    const { error } = await fn()
    setBusy(false)
    if (error) setError(translate(error.message))
    else if (next) setStep(next)
  }

  const sendCode = (e: FormEvent) => {
    e.preventDefault()
    run(
      () =>
        supabase.auth.signInWithOtp({
          email: email.trim(),
          // Only invitation links may create new accounts.
          options: { shouldCreateUser: invited, emailRedirectTo: window.location.origin },
        }),
      'code',
    )
  }

  const verifyCode = (e: FormEvent) => {
    e.preventDefault()
    run(() => supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' }))
  }

  const passwordLogin = (e: FormEvent) => {
    e.preventDefault()
    run(() => supabase.auth.signInWithPassword({ email: email.trim(), password }))
  }

  return (
    <Centered>
      <h1 className="text-3xl font-bold">
        Tukiff <span className="text-lime-400">Prog</span>
      </h1>
      {invited && <p className="text-zinc-300">Tu as été invité ! Connecte-toi pour rejoindre le groupe.</p>}

      {step === 'email' && (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button disabled={busy}>Recevoir un code de connexion</Button>
          {devLogin && (
            <button type="button" className="text-sm text-zinc-500 underline" onClick={() => setStep('password')}>
              Connexion par mot de passe (dev)
            </button>
          )}
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verifyCode} className="flex flex-col gap-3">
          <p className="text-sm text-zinc-400">
            Un email a été envoyé à <b className="text-zinc-200">{email}</b>. Ouvre le lien qu’il contient, ou
            saisis le code s’il y en a un.
          </p>
          <Input
            label="Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button disabled={busy}>Se connecter</Button>
          <button type="button" className="text-sm text-zinc-500 underline" onClick={() => setStep('email')}>
            Changer d’email
          </button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={passwordLogin} className="flex flex-col gap-3">
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            label="Mot de passe"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button disabled={busy}>Se connecter</Button>
          <button type="button" className="text-sm text-zinc-500 underline" onClick={() => setStep('email')}>
            Retour
          </button>
        </form>
      )}

      <ErrorText>{error}</ErrorText>
    </Centered>
  )
}
