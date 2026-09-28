import { initials } from '../domain/profile'

/** Round profile picture, or the name's initials when there is none. */
export function Avatar({ url, name, className = 'size-8 text-xs' }: { url: string | null | undefined; name: string | null | undefined; className?: string }) {
  if (url) return <img src={url} alt="" className={`shrink-0 rounded-full bg-zinc-800 object-cover ${className}`} />
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-800 font-semibold text-zinc-300 ${className}`}>
      {initials(name)}
    </span>
  )
}
