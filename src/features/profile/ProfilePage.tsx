import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { AvatarCropper } from '../../components/ImageCropper'
import { programColor } from '../../components/ProgramBadges'
import { Button, Card, Chips, ErrorText, Input, PageTitle } from '../../components/ui'
import { asPrefs, NOTIFICATION_CATEGORIES, notificationOn, type NotificationPrefs } from '../../domain/notifications'
import { fullName, GENDERS, type Gender } from '../../domain/profile'
import { removeAvatar, uploadAvatar } from '../../lib/avatar'
import { supabase } from '../../lib/supabase'
import { levelName, type AccessLevel } from '../../domain/workout'
import { isAdmin, roleLabel, useAuth } from '../auth/AuthProvider'
import { PasswordForm } from '../auth/ResetPasswordPage'

export function ProfilePage() {
  const { session, profile, refreshProfile } = useAuth()
  const [editingName, setEditingName] = useState(false)
  const [editingNames, setEditingNames] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [cropping, setCropping] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [programs, setPrograms] = useState<{ name: string; level: string | null }[] | null>(null)

  useEffect(() => {
    if (!session) return
    supabase
      .from('program_members')
      .select('level, programs(name, archived_at, access_levels)')
      .eq('user_id', session.user.id)
      .then(({ data }) =>
        setPrograms(
          (data ?? [])
            .flatMap((r) =>
              r.programs && !r.programs.archived_at
                ? [
                    {
                      name: r.programs.name,
                      // Level shown only for programs that have levels.
                      level: (r.programs.access_levels as AccessLevel[]).length
                        ? levelName(r.programs.access_levels as AccessLevel[], r.level)
                        : null,
                    },
                  ]
                : [],
            )
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
      )
  }, [session])

  async function update(values: { display_name?: string | null; first_name?: string; last_name?: string; gender?: Gender; notifications?: NotificationPrefs }) {
    setError('')
    setSaved(false)
    const { error } = await supabase.from('profiles').update(values).eq('id', profile!.id)
    if (error) {
      setError(error.message)
      return false
    }
    await refreshProfile()
    setSaved(true)
    return true
  }

  const prefs = asPrefs(profile?.notifications)
  const setPref = (key: keyof NotificationPrefs, on: boolean) => update({ notifications: { ...prefs, [key]: on } })

  function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setCropping(file)
  }

  async function savePhoto(picture: Blob) {
    setCropping(null)
    setError('')
    setSaved(false)
    const err = await uploadAvatar(profile!.id, picture)
    if (err) return setError(err)
    await refreshProfile()
  }

  async function deletePhoto() {
    if (!confirm('Retirer ta photo de profil ?')) return
    const err = await removeAvatar(profile!.id)
    if (err) return setError(err)
    await refreshProfile()
  }

  async function deleteAccount() {
    if (!confirm('Supprimer définitivement ton compte et tous tes scores ? Cette action est irréversible.')) return
    if (profile?.avatar_url) await removeAvatar(profile.id)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setError(
        error.message.includes('app_owner')
          ? 'Tu es le propriétaire de l’application : ton compte ne peut pas être supprimé.'
          : error.message.includes('last_admin')
            ? 'Tu es le seul admin : nomme un autre admin avant de supprimer ton compte.'
            : error.message,
      )
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <>
      <PageTitle>Profil</PageTitle>
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <Avatar url={profile?.avatar_url} name={fullName(profile)} className="size-16 text-xl" />
            <div className="flex flex-col items-start gap-1 text-sm">
              <button className="font-semibold text-lime-400" onClick={() => fileInput.current?.click()}>
                {profile?.avatar_url ? 'Changer la photo' : 'Ajouter une photo'}
              </button>
              {profile?.avatar_url && (
                <button className="text-zinc-400" onClick={deletePhoto}>
                  Retirer
                </button>
              )}
            </div>
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
          </div>
          <Row label="Email">{session?.user.email}</Row>
          <Row label="Prénom et nom">
            <span className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">{fullName({ first_name: profile?.first_name, last_name: profile?.last_name })}</span>
              <button className="shrink-0 rounded-lg bg-zinc-800 px-3 py-1 text-sm" onClick={() => setEditingNames(true)}>
                Modifier
              </button>
            </span>
          </Row>
          <Row label="Pseudo">
            <span className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">{profile?.display_name ?? <span className="text-zinc-500">Aucun</span>}</span>
              <button className="shrink-0 rounded-lg bg-zinc-800 px-3 py-1 text-sm" onClick={() => setEditingName(true)}>
                Modifier
              </button>
            </span>
          </Row>
          <Row label="Genre">
            <Chips options={GENDERS} value={(profile?.gender as Gender | null) ?? null} onChange={(gender) => update({ gender })} />
          </Row>
          <Row label="Rôle">{roleLabel(profile)}</Row>
          <Row label="Programmes">
            {programs === null ? (
              '…'
            ) : programs.length === 0 ? (
              <span className="text-zinc-500">Aucun programme</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {programs.map(({ name, level }) => (
                  <span key={name} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${programColor(name)}`}>
                    {name}
                    {level && <span className="font-normal"> · {level}</span>}
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

        <Section title="Notifications">
          <Card className="flex flex-col gap-3">
            <Toggle label="Toutes les notifications" checked={prefs.all !== false} onChange={(on) => setPref('all', on)} />
            {NOTIFICATION_CATEGORIES.map((c) => (
              <Toggle
                key={c.key}
                label={c.label}
                hint={c.hint}
                disabled={prefs.all === false}
                checked={notificationOn(prefs, c.key)}
                onChange={(on) => setPref(c.key, on)}
              />
            ))}
          </Card>
        </Section>

        {isAdmin(profile) && (
          <Section title="Admin">
            <Link to="/admin" className="flex items-center justify-between rounded-2xl bg-zinc-900 p-4">
              <span className="font-semibold">Statistiques</span>
              <span className="text-zinc-400">Usage sur 7 jours ›</span>
            </Link>
          </Section>
        )}

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

      {cropping && <AvatarCropper file={cropping} onCancel={() => setCropping(null)} onSave={savePhoto} />}
      {editingNames && (
        <NamesDialog
          initial={{ first_name: profile?.first_name ?? '', last_name: profile?.last_name ?? '' }}
          onCancel={() => setEditingNames(false)}
          onSave={async (names) => {
            if (await update(names)) setEditingNames(false)
          }}
        />
      )}
      {editingName && (
        <NameDialog
          initial={profile?.display_name ?? ''}
          onCancel={() => setEditingName(false)}
          onSave={async (display_name) => {
            if (await update({ display_name: display_name || null })) setEditingName(false)
          }}
        />
      )}
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

function NameDialog({ initial, onCancel, onSave }: { initial: string; onCancel: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave(name.trim())
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl"
      >
        <h2 className="font-semibold">Modifier mon pseudo</h2>
        <Input label="Pseudo (optionnel, affiché dans les classements à la place de « Prénom N. »)" maxLength={40} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
            Annuler
          </Button>
          <Button className="flex-1">Enregistrer</Button>
        </div>
      </form>
    </div>
  )
}

type Names = { first_name: string; last_name: string }

function NamesDialog({ initial, onCancel, onSave }: { initial: Names; onCancel: () => void; onSave: (names: Names) => void }) {
  const [names, setNames] = useState(initial)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave({ first_name: names.first_name.trim(), last_name: names.last_name.trim() })
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl"
      >
        <h2 className="font-semibold">Modifier mon prénom et mon nom</h2>
        <Input
          label="Prénom"
          required
          maxLength={40}
          autoFocus
          autoComplete="given-name"
          value={names.first_name}
          onChange={(e) => setNames({ ...names, first_name: e.target.value })}
        />
        <Input
          label="Nom"
          required
          maxLength={40}
          autoComplete="family-name"
          value={names.last_name}
          onChange={(e) => setNames({ ...names, last_name: e.target.value })}
        />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
            Annuler
          </Button>
          <Button className="flex-1">Enregistrer</Button>
        </div>
      </form>
    </div>
  )
}

function Toggle(props: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className={`flex items-center justify-between gap-3 ${props.disabled ? 'opacity-40' : ''}`}>
      <span>
        <span className="block">{props.label}</span>
        {props.hint && <span className="block text-xs text-zinc-500">{props.hint}</span>}
      </span>
      <input
        type="checkbox"
        className="size-5 shrink-0 accent-lime-400"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.checked)}
      />
    </label>
  )
}
