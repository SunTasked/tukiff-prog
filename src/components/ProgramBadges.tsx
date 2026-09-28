// Literal class names so Tailwind keeps them. A program always gets the same color.
const COLORS = [
  'bg-sky-400/15 text-sky-300',
  'bg-amber-400/15 text-amber-300',
  'bg-fuchsia-400/15 text-fuchsia-300',
  'bg-emerald-400/15 text-emerald-300',
  'bg-rose-400/15 text-rose-300',
  'bg-indigo-400/15 text-indigo-300',
]
// Subtle tint of the same color for the panel grouping a program's workouts (same order as COLORS).
const PANELS = [
  'border-sky-400/25 bg-sky-400/[0.04]',
  'border-amber-400/25 bg-amber-400/[0.04]',
  'border-fuchsia-400/25 bg-fuchsia-400/[0.04]',
  'border-emerald-400/25 bg-emerald-400/[0.04]',
  'border-rose-400/25 bg-rose-400/[0.04]',
  'border-indigo-400/25 bg-indigo-400/[0.04]',
]

function colorIndex(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % COLORS.length
}

export const programColor = (name: string) => COLORS[colorIndex(name)]
export const programPanelColor = (name: string) => PANELS[colorIndex(name)]

export function ProgramBadge({ name }: { name: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${programColor(name)}`}>{name}</span>
}
