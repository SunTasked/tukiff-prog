import { useState, type FormEvent } from 'react'
import { LogoCropper } from '../../components/ImageCropper'
import { SponsorLogo } from '../../components/SponsorLogo'
import { Button, Card, Chips, CloseButton, ErrorText, Input } from '../../components/ui'
import { normalizeLink } from '../../domain/sponsors'
import { reloadSponsors, uploadLogo, useSponsors } from '../../lib/sponsors'
import { supabase, type Sponsor } from '../../lib/supabase'

/** Communauté, admins only: the sponsors coaches can pick per block. */
export function SponsorsCard() {
  const sponsors = useSponsors().filter((s) => !s.archived_at)
  const [editing, setEditing] = useState<Sponsor | 'new' | null>(null)

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-400">Sponsors ({sponsors.length})</h3>
        <button
          className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-lime-400 text-xl leading-none font-semibold text-zinc-950"
          aria-label="Ajouter un sponsor"
          onClick={() => setEditing('new')}
        >
          +
        </button>
      </div>
      {sponsors.length > 0 && (
        <ul className="divide-y divide-zinc-800">
          {sponsors.map((s) => (
            <li key={s.id}>
              <button className="flex w-full items-center gap-3 py-2 text-left" onClick={() => setEditing(s)}>
                <SponsorLogo sponsor={s} className="h-6" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{s.name}</span>
                  {s.link && <span className="truncate text-xs text-zinc-500">{s.link.replace(/^https?:\/\//, '')}</span>}
                </span>
                <span className="text-zinc-500">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && <SponsorSheet sponsor={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function SponsorSheet({ sponsor, onClose }: { sponsor: Sponsor | null; onClose: () => void }) {
  const [name, setName] = useState(sponsor?.name ?? '')
  const [link, setLink] = useState(sponsor?.link ?? '')
  const [dark, setDark] = useState(sponsor?.logo_dark ?? false)
  const [cropping, setCropping] = useState<File | null>(null)
  const [logo, setLogo] = useState<{ blob: Blob; url: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const fields = { name: name.trim(), link: normalizeLink(link), logo_dark: dark }
    const { data, error } = sponsor
      ? await supabase.from('sponsors').update(fields).eq('id', sponsor.id).select().single()
      : await supabase.from('sponsors').insert(fields).select().single()
    let err = error?.message
    if (data && logo) {
      const up = await uploadLogo(data.id, logo.blob)
      err = up.error ?? (await supabase.from('sponsors').update({ logo_url: up.url }).eq('id', data.id)).error?.message
    }
    await reloadSponsors()
    setBusy(false)
    if (err) return setError(err)
    onClose()
  }

  async function remove() {
    if (!sponsor || !confirm(`Retirer « ${sponsor.name} » ? Il ne sera plus proposé ; les blocs passés gardent son logo.`)) return
    const { error } = await supabase.from('sponsors').update({ archived_at: new Date().toISOString() }).eq('id', sponsor.id)
    await reloadSponsors()
    if (error) return setError(error.message)
    onClose()
  }

  const preview = { name: name || 'Sponsor', logo_url: logo?.url ?? sponsor?.logo_url ?? null, logo_dark: dark }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 pt-[env(safe-area-inset-top)] lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black">
      <div className="flex items-center justify-between border-b border-zinc-800 p-3">
        <span className="font-semibold">{sponsor ? 'Modifier le sponsor' : 'Nouveau sponsor'}</span>
        <CloseButton onClick={onClose} />
      </div>
      <form onSubmit={save} className="flex flex-col gap-4 overflow-y-auto p-4">
        <Input label="Nom" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <span className="mb-1 block text-sm text-zinc-400">Logo</span>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-zinc-700 p-3">
            <SponsorLogo sponsor={preview} className="h-8" />
            <span className="text-sm text-lime-400">{preview.logo_url ? 'Changer' : 'Choisir une image'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) setCropping(file)
              }}
            />
          </label>
          <span className="mt-2 mb-0.5 block text-xs text-zinc-500">Fond du logo</span>
          <Chips options={{ light: 'Clair', dark: 'Sombre' }} value={dark ? 'dark' : 'light'} onChange={(v) => setDark(v === 'dark')} />
        </div>
        <Input label="Lien (optionnel)" inputMode="url" placeholder="kanda-fitness.fr" value={link} onChange={(e) => setLink(e.target.value)} />
        <ErrorText>{error}</ErrorText>
        <Button disabled={busy || !name.trim()}>{sponsor ? 'Enregistrer' : 'Ajouter'}</Button>
        {sponsor && (
          <Button type="button" variant="danger" onClick={remove}>
            Retirer ce sponsor
          </Button>
        )}
      </form>
      {cropping && (
        <LogoCropper
          file={cropping}
          dark={dark}
          onCancel={() => setCropping(null)}
          onSave={(blob) => {
            if (logo) URL.revokeObjectURL(logo.url)
            setLogo({ blob, url: URL.createObjectURL(blob) })
            setCropping(null)
          }}
        />
      )}
    </div>
  )
}
