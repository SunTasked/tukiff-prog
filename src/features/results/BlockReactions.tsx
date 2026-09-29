import { useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { REACTION_EMOJIS, reactionCounts } from '../../domain/reactions'
import { supabase } from '../../lib/supabase'

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
  // Emoji tab of the "who reacted" sheet (null: all), undefined: closed.
  const [who, setWho] = useState<string | null | undefined>(undefined)
  const mine = reactions.find((r) => r.user_id === me)?.emoji
  const counts = reactionCounts(reactions.map((r) => r.emoji))

  async function react(emoji: string | null) {
    setPicking(false)
    setWho(undefined)
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
          onClick={() => setWho(emoji)}
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

      {who !== undefined && (
        <Sheet onClose={() => setWho(undefined)}>
          <WhoReacted
            reactions={reactions}
            counts={counts}
            tab={who}
            onTab={setWho}
            mine={mine}
            onRemove={() => react(null)}
            onClose={() => setWho(undefined)}
          />
        </Sheet>
      )}
    </div>
  )
}

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 lg:items-center lg:justify-center" onClick={onClose}>
      <div
        className="flex max-h-[75vh] w-full flex-col overflow-hidden rounded-t-2xl bg-zinc-900 pb-[env(safe-area-inset-bottom)] lg:w-[26rem] lg:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

/** Who reacted with what, a tab per emoji (like Facebook). */
function WhoReacted({
  reactions,
  counts,
  tab,
  onTab,
  mine,
  onRemove,
  onClose,
}: {
  reactions: Reaction[]
  counts: { emoji: string; count: number }[]
  tab: string | null
  onTab: (tab: string | null) => void
  mine: string | undefined
  onRemove: () => void
  onClose: () => void
}) {
  const shown = reactions.filter((r) => tab === null || r.emoji === tab)
  const tabClass = (on: boolean) => `shrink-0 rounded-full px-3 py-1 text-sm ${on ? 'bg-lime-400/20 text-lime-300' : 'text-zinc-400'}`
  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 p-3">
        <button className={tabClass(tab === null)} onClick={() => onTab(null)}>
          Tous {reactions.length}
        </button>
        {counts.map(({ emoji, count }) => (
          <button key={emoji} className={tabClass(tab === emoji)} onClick={() => onTab(emoji)}>
            {emoji} {count}
          </button>
        ))}
        <button className="ml-auto shrink-0 px-2 text-zinc-400" onClick={onClose}>
          Fermer
        </button>
      </div>
      <ul className="flex flex-col gap-1 overflow-y-auto p-3">
        {shown.map((r) => (
          <li key={r.user_id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <Avatar url={r.profiles?.avatar_url} name={r.profiles?.display_name} className="size-7 text-[10px]" />
            <span className="min-w-0 flex-1 truncate text-sm">{r.profiles?.display_name ?? '—'}</span>
            <span className="text-lg">{r.emoji}</span>
          </li>
        ))}
      </ul>
      {mine && (
        <button className="mx-3 mb-3 rounded-xl bg-zinc-800 py-2 text-sm text-zinc-300" onClick={onRemove}>
          Retirer ma réaction {mine}
        </button>
      )}
    </>
  )
}
