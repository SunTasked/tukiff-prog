import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Card, CloseButton } from '../../components/ui'
import { clapsMessage } from '../../domain/clapsMessage'
import { formatLongDay } from '../../domain/dates'
import type { Audience } from '../../domain/releases'
import { clapCompliments, markClapsRead, newClappers } from '../../lib/clapsNotification'
import { markMessagesRead, releasesFor } from '../../lib/releases'
import { useAuth } from '../auth/AuthProvider'

// Athlete notes first, unlabelled; coach and admin notes under a named separator.
const GROUPS: { audience: Audience; label?: string }[] = [
  { audience: 'athlete' },
  { audience: 'coach', label: 'Coach' },
  { audience: 'admin', label: 'Admin' },
]

export function MessagesPage() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [releases] = useState(() => releasesFor(profile))
  // Claps counted once, then marked read: the note lives only for this visit and is never stored.
  const [clapsNote, setClapsNote] = useState<string | null>(null)
  useEffect(() => {
    void (async () => {
      const n = await newClappers(profile)
      if (n > 0) setClapsNote(clapsMessage(n, await clapCompliments(), profile?.gender ?? null))
      const [changed, claps] = await Promise.all([markMessagesRead(profile), markClapsRead(profile)])
      if (changed || claps) void refreshProfile()
    })()
  }, [])
  // Opened from the bell: back to it; opened directly (link, reload): home.
  const close = () => (location.key === 'default' ? navigate('/') : navigate(-1))

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Messages</h1>
        <CloseButton onClick={close} />
      </div>
      <div className="flex flex-col gap-3">
        {clapsNote && <Card className="text-sm">{clapsNote}</Card>}
        {releases.length === 0 && !clapsNote && <Card className="text-zinc-400">Aucun message.</Card>}
        {releases.map((r) => (
          <Card key={r.version}>
            <details open={r.unread} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                <span>
                  <span className="block font-semibold">
                    Mise à jour {r.version}
                    {r.unread && <span className="ml-2 inline-block size-2 rounded-full bg-red-500 align-middle" />}
                  </span>
                  <span className="block text-xs text-zinc-500 first-letter:uppercase">{formatLongDay(r.date)}</span>
                </span>
                <span className="text-zinc-500 transition-transform group-open:rotate-180">▾</span>
              </summary>
              {GROUPS.map(({ audience, label }) => {
                const notes = r.notes.filter((n) => n.audience === audience)
                if (!notes.length) return null
                return (
                  <div key={audience}>
                    {label && (
                      <div className="mt-3 flex items-center gap-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                        {label}
                        <span className="h-px flex-1 bg-zinc-800" />
                      </div>
                    )}
                    <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-zinc-300">
                      {notes.map((n) => (
                        <li key={n.text}>{n.text}</li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </details>
          </Card>
        ))}
      </div>
    </>
  )
}
