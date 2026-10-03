import { initials } from '../domain/profile'

/** Round profile picture, or the name's initials when there is none. crown: 3 blocks won (weekly leaderboard). */
export function Avatar({
  url,
  name,
  crown = false,
  className = 'size-8 text-xs',
}: {
  url: string | null | undefined
  name: string | null | undefined
  crown?: boolean
  className?: string
}) {
  const picture = url ? (
    <img src={url} alt="" className={`shrink-0 rounded-full bg-zinc-800 object-cover ${className}`} />
  ) : (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-800 font-semibold text-zinc-300 ${className}`}>
      {initials(name)}
    </span>
  )
  if (!crown) return picture
  return (
    <span className="relative inline-flex shrink-0">
      {picture}
      <Crown className="pointer-events-none absolute bottom-[78%] left-1/2 w-[62%] -translate-x-1/2" />
    </span>
  )
}

/** Straight gold crown (the emoji is drawn tilted on some devices). */
export function Crown({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 18" className={className} role="img" aria-label="Couronne">
      <path d="M2 6 L7 11 L12 3 L17 11 L22 6 L20 16 H4 Z" fill="#facc15" stroke="#a16207" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="2" cy="5.5" r="1.6" fill="#facc15" />
      <circle cx="12" cy="2.5" r="1.6" fill="#facc15" />
      <circle cx="22" cy="5.5" r="1.6" fill="#facc15" />
    </svg>
  )
}
