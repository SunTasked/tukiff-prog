import { useState } from 'react'
import { firstEmoji, reactionCounts } from '../../domain/reactions'
import { supabase } from '../../lib/supabase'

export type Reaction = { block_id: string; user_id: string; emoji: string }

/** Emoji bar: one reaction per member and block (tap again to remove, another emoji to change). */
export function BlockReactions({
  workoutId,
  blockId,
  reactions,
  me,
  canReact,
  onChange,
}: {
  workoutId: string
  blockId: string
  reactions: Reaction[]
  me: string | undefined
  canReact: boolean
  onChange: () => void
}) {
  const [picking, setPicking] = useState(false)
  const mine = reactions.find((r) => r.user_id === me)?.emoji
  const counts = reactionCounts(reactions.map((r) => r.emoji))

  async function react(emoji: string) {
    setPicking(false)
    if (emoji === mine) await supabase.from('block_reactions').delete().eq('block_id', blockId).eq('user_id', me!)
    else
      await supabase
        .from('block_reactions')
        .upsert({ block_id: blockId, workout_id: workoutId, emoji }, { onConflict: 'block_id,user_id' })
    onChange()
  }

  // Read-only (coach planning view): only emojis actually used.
  const shown = canReact ? counts : counts.filter((c) => c.count > 0)
  if (!shown.length) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {shown.map(({ emoji, count }) => (
        <button
          key={emoji}
          disabled={!canReact}
          onClick={() => react(emoji)}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-lg leading-none ${
            emoji === mine ? 'bg-lime-400/20 ring-1 ring-lime-400/60' : 'bg-zinc-950'
          }`}
        >
          {emoji}
          {count > 0 && <span className="text-xs font-semibold text-zinc-300">{count}</span>}
        </button>
      ))}
      {canReact &&
        (picking ? (
          <input
            autoFocus
            aria-label="Choisir un emoji"
            placeholder="🙂"
            className="w-14 rounded-full border border-lime-400 bg-zinc-950 px-2 py-1 text-center text-lg"
            onChange={(e) => {
              const emoji = firstEmoji(e.target.value)
              if (emoji) react(emoji)
            }}
            onBlur={() => setPicking(false)}
          />
        ) : (
          <button
            aria-label="Autre emoji"
            className="rounded-full bg-zinc-950 px-3 py-1 text-lg leading-none text-zinc-400"
            onClick={() => setPicking(true)}
          >
            +
          </button>
        ))}
    </div>
  )
}
