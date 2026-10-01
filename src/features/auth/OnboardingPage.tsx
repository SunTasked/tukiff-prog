import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Avatar } from '../../components/Avatar'
import { AvatarCropper } from '../../components/ImageCropper'
import { PasswordFields } from '../../components/PasswordFields'
import { Button, Centered, Chips, ErrorText, Input } from '../../components/ui'
import { isValidPassword } from '../../domain/password'
import { fullName, GENDERS, type Gender } from '../../domain/profile'
import { uploadAvatar } from '../../lib/avatar'
import { supabase } from '../../lib/supabase'
import { hasPassword, useAuth } from './AuthProvider'

/** First sign-in (via magic link): first and last name, an optional nickname and photo, a gender (for the leaderboards) and a password. */
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
  const fileInput = useRef<HTMLInputElement>(null)
  const [cropping, setCropping] = useState<File | null>(null)
  // Cropped picture, uploaded with the rest of the form.
  const [picture, setPicture] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!picture) return setPreview(null)
    const url = URL.createObjectURL(picture)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [picture])

  function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setCropping(file)
  }

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
    const { error } = await supabase.from('profiles').update({ first_name: firstName.trim(), last_name: lastName.trim(), display_name: name.trim() || null, gender }).eq('id', profile!.id)
    const err = !error && picture ? await uploadAvatar(profile!.id, picture) : null
    setBusy(false)
    if (error) return setError(error.message)
    if (err) return setError(err)
    await Promise.all([refreshProfile(), refreshSession()])
  }

  return (
    <Centered>
      <h1 className="text-2xl font-bold">Bienvenue !</h1>
      <p className="text-sm text-zinc-400">
        Indique ton prénom, ton nom, ton genre{needsPassword && ' et un mot de passe : tu t’en serviras pour te reconnecter'}.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <Avatar url={preview} name={fullName({ first_name: firstName, last_name: lastName })} className="size-16 text-xl" />
          <div className="flex flex-col items-start gap-1 text-sm">
            <button type="button" className="font-semibold text-lime-400" onClick={() => fileInput.current?.click()}>
              {picture ? 'Changer la photo' : 'Ajouter une photo (optionnel)'}
            </button>
            {picture && (
              <button type="button" className="text-zinc-400" onClick={() => setPicture(null)}>
                Retirer
              </button>
            )}
          </div>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
        </div>
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
          label="Pseudo (optionnel, affiché dans les classements)"
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
      {cropping && (
        <AvatarCropper
          file={cropping}
          onCancel={() => setCropping(null)}
          onSave={(p) => {
            setCropping(null)
            setPicture(p)
          }}
        />
      )}
    </Centered>
  )
}
