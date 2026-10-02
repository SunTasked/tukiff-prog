import { useEffect, useState } from 'react'
import { Card, PageTitle } from '../../components/ui'
import { formatLongDay } from '../../domain/dates'
import type { Audience } from '../../domain/releases'
import { markMessagesRead, releasesFor } from '../../lib/releases'
import { isAdmin, isCoach, useAuth } from '../auth/AuthProvider'

const TAGS: Partial<Record<Audience, string>> = { coach: 'Coach', admin: 'Admin' }

export function MessagesPage() {
  const { profile } = useAuth()
  const [releases] = useState(() => releasesFor({ coach: isCoach(profile), admin: isAdmin(profile) }))
  useEffect(() => markMessagesRead(), [])

  return (
    <>
      <PageTitle>Messages</PageTitle>
      <div className="flex flex-col gap-3">
        {releases.length === 0 && <Card className="text-zinc-400">Aucun message.</Card>}
        {releases.map((r) => (
          <Card key={r.version}>
            <p className="font-semibold">Mise à jour {r.version}</p>
            <p className="text-xs text-zinc-500 first-letter:uppercase">{formatLongDay(r.date)}</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-zinc-300">
              {r.notes.map((n) => (
                <li key={n.audience + n.text}>
                  {TAGS[n.audience] && (
                    <span className="mr-1.5 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">{TAGS[n.audience]}</span>
                  )}
                  {n.text}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  )
}
