/**
 * Red leader tag, CrossFit Games style: the week's leader of the program. short: "L" (block leaderboards).
 * gold: 3 blocks won this week (30 points), the crown worn next week.
 */
export function LeaderBadge({ short = false, gold = false }: { short?: boolean; gold?: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-sm px-1 py-px text-[9px] leading-tight font-extrabold tracking-wider ${gold ? 'bg-yellow-400 text-zinc-950' : 'bg-red-600 text-white'}`}
      title={short ? 'Leader de la semaine' : undefined}
    >
      {short ? 'L' : 'LEADER'}
    </span>
  )
}
