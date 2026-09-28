import type React from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { Card, ErrorText, PageTitle } from '../../components/ui'
import { isDormant, lastActivityLabel, pageLabel } from '../../domain/usage'
import { supabase } from '../../lib/supabase'
import { roleLabel } from '../auth/AuthProvider'

type UserRow = {
  id: string
  display_name: string | null
  role: string
  is_admin: boolean
  avatar_url: string | null
  last_at: string | null
  sessions: number
  views: number
  active_days: number
  scores: number
}

/** Shape returned by the admin_usage() function (migration 0026): the last 7 days. */
type Stats = {
  members: number
  active_1d: number
  active_7d: number
  sessions: number
  standalone_sessions: number
  views: number
  avg_launch_ms: number | null
  avg_view_ms: number | null
  scores: number
  scorers: number
  reactions: number
  records: number
  daily: { day: string; users: number; views: number }[]
  load_slots: { at: string; avg_ms: number; max_ms: number; n: number }[]
  users: UserRow[]
  pages: { key: string; views: number; users: number; avg_ms: number | null }[]
  errors: { key: string; count: number; users: number; last_at: string }[]
}

const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)} %` : '–')
const seconds = (ms: number | null) => (ms === null ? '–' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`)
const parseDay = (d: string) => new Date(`${d}T12:00:00`)

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </Card>
  )
}

function DailyChart({ daily, members }: { daily: Stats['daily']; members: number }) {
  const max = Math.max(1, ...daily.map((d) => d.users))
  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">Membres actifs par jour</h2>
        <span className="text-xs text-zinc-500">max {max} / {members}</span>
      </div>
      <div className="flex h-24 items-end gap-0.5" role="img" aria-label="Membres actifs par jour">
        {daily.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-lime-400 group-hover:bg-lime-300"
              style={{ height: d.users ? `${(d.users / max) * 100}%` : '2px', opacity: d.users ? 1 : 0.25 }}
              title={`${dayFmt.format(parseDay(d.day))} : ${d.users} membre${d.users > 1 ? 's' : ''}, ${d.views} pages`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-zinc-500">
        <span>{daily.length ? dayFmt.format(parseDay(daily[0].day)) : ''}</span>
        <span>Aujourd’hui</span>
      </div>
    </Card>
  )
}

const SLOT_MS = 10 * 60 * 1000
const SLOTS = 7 * 24 * 6
const slotFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
const weekdayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })

/** Average screen load time per 10-minute slot over 7 days; tap or hover a slot for its details. */
function LoadChart({ slots }: { slots: Stats['load_slots'] }) {
  const [selected, setSelected] = useState<number | null>(null)
  const first = Math.floor(Date.now() / SLOT_MS) * SLOT_MS - (SLOTS - 1) * SLOT_MS
  const bySlot = new Map(slots.map((s) => [Math.round((new Date(s.at).getTime() - first) / SLOT_MS), s]))
  const max = Math.max(1, ...slots.map((s) => s.avg_ms))
  // Local midnights inside the window, for the day ticks.
  const ticks: { i: number; label: string }[] = []
  for (let i = 0; i < SLOTS; i++) {
    const d = new Date(first + i * SLOT_MS)
    if (d.getHours() === 0 && d.getMinutes() < 10) ticks.push({ i, label: weekdayFmt.format(d) })
  }

  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setSelected(Math.min(SLOTS - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * SLOTS))))
  }
  const sel = selected === null ? null : bySlot.get(selected)

  return (
    <Card>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Chargement des écrans</h2>
        <span className="shrink-0 text-xs text-zinc-500">moy. / 10 min · max {seconds(max)}</span>
      </div>
      <p className="mb-2 h-4 text-xs text-zinc-400">
        {selected === null
          ? 'Touche le graphique pour le détail.'
          : `${slotFmt.format(new Date(first + selected * SLOT_MS))} · ` +
            (sel ? `${seconds(sel.avg_ms)} en moyenne, max ${seconds(sel.max_ms)} · ${sel.n} écran${sel.n > 1 ? 's' : ''}` : 'aucun écran chargé')}
      </p>
      <div className="relative h-28 touch-none" onPointerDown={pick} onPointerMove={pick} onPointerLeave={() => setSelected(null)}>
        <svg viewBox={`0 0 ${SLOTS} 100`} preserveAspectRatio="none" className="size-full" role="img" aria-label="Temps de chargement moyen des écrans par tranche de 10 minutes">
          {ticks.map((t) => (
            <line key={t.i} x1={t.i} x2={t.i} y1={0} y2={100} className="stroke-zinc-800" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          ))}
          {[...bySlot].map(([i, s]) => {
            const h = Math.max(2, (s.avg_ms / max) * 100)
            return <rect key={i} x={i} y={100 - h} width={1.5} height={h} className="fill-lime-400" />
          })}
          {selected !== null && (
            <line x1={selected + 0.5} x2={selected + 0.5} y1={0} y2={100} className="stroke-zinc-300" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          )}
        </svg>
      </div>
      <div className="relative mt-1 h-4 text-xs text-zinc-500">
        {ticks.map((t) => (
          <span key={t.i} className="absolute" style={{ left: `${(t.i / SLOTS) * 100}%` }}>
            {t.label}
          </span>
        ))}
      </div>
    </Card>
  )
}

export function AdminStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('admin_usage', undefined, { get: true }).then(({ data, error }) => {
      setError(error?.message ?? '')
      setStats((data as Stats | null) ?? null)
    })
  }, [])

  const now = new Date()
  const s = stats
  const maxPage = Math.max(1, ...(s?.pages.map((p) => p.views) ?? []))

  return (
    <div className="flex flex-col gap-4 lg:mx-auto lg:max-w-4xl">
      <PageTitle>Statistiques</PageTitle>
      <p className="-mt-3 text-sm text-zinc-500">7 derniers jours (les données plus anciennes sont effacées).</p>
      <ErrorText>{error}</ErrorText>
      {!s ? (
        !error && <p className="text-sm text-zinc-500">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <Tile label="Actifs aujourd’hui" value={s.active_1d} hint={`sur ${s.members} membres`} />
            <Tile label="Actifs sur 7 j" value={s.active_7d} hint={pct(s.active_7d, s.members) + ' des membres'} />
            <Tile label="Sessions" value={s.sessions} hint={`${pct(s.standalone_sessions, s.sessions)} en appli installée`} />
            <Tile label="Pages vues" value={s.views} hint={s.sessions ? `${(s.views / s.sessions).toFixed(1).replace('.', ',')} par session` : undefined} />
            <Tile label="Ouverture de l’appli" value={seconds(s.avg_launch_ms)} hint="lancement → appli utilisable" />
            <Tile label="Chargement d’un écran" value={seconds(s.avg_view_ms)} hint="moyenne, données comprises" />
            <Tile label="Scores saisis" value={s.scores} hint={`par ${s.scorers} membre${s.scorers > 1 ? 's' : ''}`} />
            <Tile label="Réactions" value={s.reactions} />
            <Tile label="Records ajoutés" value={s.records} />
            <Tile label="Erreurs" value={s.errors.reduce((n, e) => n + e.count, 0)} hint="remontées par l’appli" />
          </div>

          <LoadChart slots={s.load_slots} />

          <DailyChart daily={s.daily} members={s.members} />

          <Card>
            <h2 className="mb-1 font-semibold">Activité par membre</h2>
            <p className="mb-2 text-xs text-zinc-500">Compteurs sur 7 jours. En orange : inactif depuis 14 jours ou plus.</p>
            <ul className="divide-y divide-zinc-800">
              {s.users.map((u) => (
                <li key={u.id}>
                  <Link to={`/athletes/${u.id}`} className="flex items-center gap-3 py-2">
                    <Avatar url={u.avatar_url} name={u.display_name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">
                          {u.display_name ?? '?'} <span className="text-xs text-zinc-500">{roleLabel(u)}</span>
                        </span>
                        <span
                          className={`shrink-0 text-xs ${isDormant(u.last_at, now) ? 'text-amber-400' : 'text-zinc-400'}`}
                          title={u.last_at ? dateTimeFmt.format(new Date(u.last_at)) : undefined}
                        >
                          {lastActivityLabel(u.last_at, now)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {u.sessions} sessions · {u.views} pages · {u.active_days} j actifs · {u.scores} scores
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Écrans les plus consultés</h2>
            {!s.pages.length && <p className="text-sm text-zinc-500">Aucune donnée sur la période.</p>}
            <ul className="flex flex-col gap-2">
              {s.pages.map((p) => (
                <li key={p.key} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{pageLabel(p.key)}</span>
                    <span className="shrink-0 text-zinc-400">
                      {p.views} · {p.users} membre{p.users > 1 ? 's' : ''} · {seconds(p.avg_ms)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded bg-zinc-800">
                    <div className="h-1 rounded bg-lime-400" style={{ width: `${(p.views / maxPage) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Erreurs récentes</h2>
            {!s.errors.length && <p className="text-sm text-zinc-500">Aucune erreur remontée sur la période.</p>}
            <ul className="divide-y divide-zinc-800">
              {s.errors.map((e) => (
                <li key={e.key} className="py-2 text-sm">
                  <p className="break-words font-mono text-xs text-red-300">{e.key}</p>
                  <p className="text-xs text-zinc-500">
                    {e.count} fois · {e.users} membre{e.users > 1 ? 's' : ''} · dernière le {dateTimeFmt.format(new Date(e.last_at))}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
