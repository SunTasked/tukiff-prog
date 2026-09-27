import type { Assignment } from '../lib/supabase'

// Literal class names so Tailwind keeps them. A program always gets the same color.
const COLORS = [
  'bg-sky-400/15 text-sky-300',
  'bg-amber-400/15 text-amber-300',
  'bg-fuchsia-400/15 text-fuchsia-300',
  'bg-emerald-400/15 text-emerald-300',
  'bg-rose-400/15 text-rose-300',
  'bg-indigo-400/15 text-indigo-300',
]

export function programColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

export type BadgeAssignment = Assignment & { programs?: { name: string } | null }

/**
 * One badge per target: program name, "Tous", or for an athlete-specific workout
 * the athlete's name (coach views) or "Perso".
 */
export function ProgramBadges({
  assignments,
  athleteName,
}: {
  assignments: BadgeAssignment[]
  athleteName?: (id: string) => string | undefined
}) {
  const labels = [
    ...new Set(
      assignments.map((a) =>
        a.program_id
          ? (a.programs?.name ?? 'Programme')
          : a.athlete_id
            ? (athleteName?.(a.athlete_id) ?? 'Perso')
            : 'Tous',
      ),
    ),
  ]
  const programNames = new Set(assignments.flatMap((a) => (a.programs?.name ? [a.programs.name] : [])))
  return (
    <span className="flex flex-wrap gap-1">
      {labels.length === 0 && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-300">Aucune cible</span>}
      {labels.map((l) => (
        <span
          key={l}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            programNames.has(l) ? programColor(l) : 'bg-zinc-800 text-zinc-300'
          }`}
        >
          {l}
        </span>
      ))}
    </span>
  )
}
