import { useEffect, useState } from 'react'
import { scoreName, shortName } from '../../domain/profile'

type Names = { display_name: string | null; first_name: string | null; last_name: string | null } | null

/** Leaderboard name: a nickname is outlined and reveals "Prénom N." on tap; otherwise "Prénom N." as is. */
export function AthleteName({ profile }: { profile: Names }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const timer = setTimeout(close, 3000)
    document.addEventListener('pointerdown', close)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerdown', close)
    }
  }, [open])

  if (!profile?.display_name || !profile.first_name) return <span className="min-w-0 truncate">{scoreName(profile)}</span>
  return (
    <span className="relative min-w-0">
      <button
        type="button"
        className="max-w-full truncate rounded-md border border-zinc-600 px-1.5 text-left"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        {profile.display_name}
      </button>
      {open && (
        <span className="absolute top-full left-0 z-20 mt-1 rounded-lg bg-zinc-100 px-2 py-1 text-xs font-semibold whitespace-nowrap text-zinc-900 shadow-lg">
          {shortName(profile)}
        </span>
      )}
    </span>
  )
}
