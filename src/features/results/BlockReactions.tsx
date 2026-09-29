import { useState } from 'react'
import { REACTION_EMOJIS, reactionCounts } from '../../domain/reactions'
import { supabase } from '../../lib/supabase'
import { PeopleSheet } from './PeopleSheet'

export type Reaction = {
  block_id: string
  user_id: string
  emoji: string
  profiles: { display_name: string | null; avatar_url: string | null } | null
}

/**
 * Reactions right after the block title: one per member and block. Only emojis used at least once are shown;
 * tap one to see who reacted with what (and remove mine there), "+" (only while I haven't reacted) offers the club's faces.
 */
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
  const [who, setWho] = useState(false)
  const mine = reactions.find((r) => r.user_id === me)?.emoji
  const counts = reactionCounts(reactions.map((r) => r.emoji))

  async function react(emoji: string | null) {
    setPicking(false)
    setWho(false)
    if (!emoji || emoji === mine) await supabase.from('block_reactions').delete().eq('block_id', blockId).eq('user_id', me!)
    else
      await supabase
        .from('block_reactions')
        .upsert({ block_id: blockId, workout_id: workoutId, emoji }, { onConflict: 'block_id,user_id' })
    onChange()
  }

  if (!canReact && !counts.length) return null

  return (
    <div className="flex flex-wrap items-center gap-1">
      {counts.map(({ emoji, count }) => (
        <button
          key={emoji}
          aria-label={`${emoji} ${count}, voir qui a réagi`}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-base leading-none ${
            emoji === mine ? 'bg-lime-400/20 ring-1 ring-lime-400/60' : 'bg-zinc-950'
          }`}
          onClick={() => setWho(true)}
        >
          {emoji}
          <span className="text-xs font-semibold text-zinc-300">{count}</span>
        </button>
      ))}
      {canReact &&
        !mine &&
        (picking ? (
          <div className="flex items-center gap-0.5 rounded-full bg-zinc-800 px-1 py-0.5">
            {REACTION_EMOJIS.map((emoji) => (
              <button key={emoji} className="px-1 text-lg leading-none" onClick={() => react(emoji)}>
                {emoji}
              </button>
            ))}
            <button aria-label="Annuler" className="px-1.5 text-sm text-zinc-400" onClick={() => setPicking(false)}>
              ✕
            </button>
          </div>
        ) : (
          <button
            aria-label="Ajouter une réaction"
            className="flex size-7 items-center justify-center rounded-full bg-zinc-950 text-lg leading-none text-zinc-400"
            onClick={() => setPicking(true)}
          >
            +
          </button>
        ))}

      {who && (
        <PeopleSheet
          title={`Réactions (${reactions.length})`}
          people={reactions.map((r) => ({
            id: r.user_id,
            profiles: r.profiles,
            mark: r.emoji,
            onRemove: canReact && r.user_id === me ? () => react(null) : undefined,
          }))}
          onClose={() => setWho(false)}
        />
      )}
    </div>
  )
}
