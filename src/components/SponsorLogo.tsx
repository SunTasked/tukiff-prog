import type { Sponsor } from '../lib/supabase'

/** Logo on its pill (light, or dark for a light logo); the name when there is no logo. */
export function SponsorLogo({ sponsor, className = 'h-5' }: { sponsor: Pick<Sponsor, 'name' | 'logo_url' | 'logo_dark'>; className?: string }) {
  const bg = sponsor.logo_dark ? 'bg-zinc-800' : 'bg-zinc-100'
  if (!sponsor.logo_url)
    return (
      <span className={`inline-flex items-center rounded-md px-1.5 text-xs font-bold whitespace-nowrap ${bg} ${sponsor.logo_dark ? 'text-zinc-100' : 'text-zinc-900'} ${className}`}>
        {sponsor.name}
      </span>
    )
  return (
    <span className={`inline-flex shrink-0 rounded-md px-1 ${bg}`}>
      <img src={sponsor.logo_url} alt={sponsor.name} className={`w-auto ${className}`} />
    </span>
  )
}
