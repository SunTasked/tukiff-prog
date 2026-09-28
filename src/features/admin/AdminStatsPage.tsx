import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { Card, Chips, ErrorText, PageTitle } from '../../components/ui'
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

/** Shape returned by the admin_usage() function (migration 0026). */
type Stats = {
  days: number
  members: number
  active_1d: number
  active_7d: number
  active_30d: number
  active_period: number
  sessions: number
  standalone_sessions: number
  views: number
  avg_load_ms: number | null
  scores: number
  scorers: number
  reactions: number
  records: number
  daily: { day: string; users: number; views: number }[]
  users: UserRow[]
  pages: { key: string; views: number; users: number }[]
  errors: { key: string; count: number; users: number; last_at: string }[]
}

const periods = { '7': '7 jours', '30': '30 jours', '90': '90 jours' }
type Period = keyof typeof periods

const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)} %` : '–')
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

export function AdminStatsPage() {
  const [period, setPeriod] = useState<Period>('30')
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('admin_usage', { p_days: Number(period) }, { get: true }).then(({ data, error }) => {
      setError(error?.message ?? '')
      setStats((data as Stats | null) ?? null)
    })
  }, [period])

  const now = new Date()
  const s = stats
  const maxPage = Math.max(1, ...(s?.pages.map((p) => p.views) ?? []))

  return (
    <div className="flex flex-col gap-4 lg:mx-auto lg:max-w-4xl">
      <PageTitle>Statistiques</PageTitle>
      <Chips options={periods} value={period} onChange={setPeriod} />
      <ErrorText>{error}</ErrorText>
      {!s ? (
        !error && <p className="text-sm text-zinc-500">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Tile label="Actifs aujourd’hui" value={s.active_1d} hint={`sur ${s.members} membres`} />
            <Tile label="Actifs sur 7 j" value={s.active_7d} hint={pct(s.active_7d, s.members) + ' des membres'} />
            <Tile label="Actifs sur 30 j" value={s.active_30d} hint={pct(s.active_30d, s.members) + ' des membres'} />
            <Tile
              label="Régularité"
              value={s.active_30d ? pct(s.active_7d, s.active_30d) : '–'}
              hint="actifs 7 j / actifs 30 j"
            />
            <Tile label="Sessions" value={s.sessions} hint={`${pct(s.standalone_sessions, s.sessions)} en appli installée`} />
            <Tile label="Pages vues" value={s.views} hint={s.sessions ? `${(s.views / s.sessions).toFixed(1).replace('.', ',')} par session` : undefined} />
            <Tile
              label="Chargement moyen"
              value={s.avg_load_ms === null ? '–' : `${(s.avg_load_ms / 1000).toFixed(1).replace('.', ',')} s`}
              hint="ouverture → appli utilisable"
            />
            <Tile label="Scores saisis" value={s.scores} hint={`par ${s.scorers} membre${s.scorers > 1 ? 's' : ''}`} />
            <Tile label="Réactions" value={s.reactions} />
            <Tile label="Records ajoutés" value={s.records} />
          </div>

          <DailyChart daily={s.daily} members={s.members} />

          <Card>
            <h2 className="mb-1 font-semibold">Activité par membre</h2>
            <p className="mb-2 text-xs text-zinc-500">Sur {periods[period]}. En orange : inactif depuis 14 jours ou plus.</p>
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
                      {p.views} · {p.users} membre{p.users > 1 ? 's' : ''}
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
