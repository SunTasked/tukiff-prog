/** Red leader tag, CrossFit Games style: the week's leader of the program. short: "L" (block leaderboards). */
export function LeaderBadge({ short = false }: { short?: boolean }) {
  return (
    <span
      className="shrink-0 rounded-sm bg-red-600 px-1 py-px text-[9px] leading-tight font-extrabold tracking-wider text-white"
      title={short ? 'Leader de la semaine' : undefined}
    >
      {short ? 'L' : 'LEADER'}
    </span>
  )
}
