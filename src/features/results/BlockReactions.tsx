import { useRef, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { DEFAULT_REACTION, PICKER_EMOJIS, firstEmoji, reactionCounts } from '../../domain/reactions'
import { supabase } from '../../lib/supabase'

export type Reaction = {
  block_id: string
  user_id: string
  emoji: string
  profiles: { display_name: string | null; avatar_url: string | null } | null
}

const LONG_PRESS_MS = 400

/**
 * Facebook-style reactions next to the block title: one per member and block. Tap on the button = default reaction
 * (tap again to remove), long press = emoji picker. The summary (top 3 emojis + total) lists who reacted.
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
  const [custom, setCustom] = useState(false)
  const [who, setWho] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const longPressed = useRef(false)
  const mine = reactions.find((r) => r.user_id === me)?.emoji
  const counts = reactionCounts(reactions.map((r) => r.emoji))

  async function react(emoji: string | null) {
    setPicking(false)
    setCustom(false)
    if (!emoji) await supabase.from('block_reactions').delete().eq('block_id', blockId).eq('user_id', me!)
    else
      await supabase
        .from('block_reactions')
        .upsert({ block_id: blockId, workout_id: workoutId, emoji }, { onConflict: 'block_id,user_id' })
    onChange()
  }

  function pressStart() {
    longPressed.current = false
    timer.current = window.setTimeout(() => {
      longPressed.current = true
      setPicking(true)
    }, LONG_PRESS_MS)
  }
  const pressEnd = () => window.clearTimeout(timer.current)

  if (!canReact && !counts.length) return null

  return (
    <div className="relative flex items-center gap-1.5">
      {counts.length > 0 && (
        <button
          aria-label="Voir les réactions"
          className="flex items-center rounded-full bg-zinc-950 py-1 pr-2 pl-1.5 text-sm leading-none"
          onClick={() => setWho(true)}
        >
          <span className="flex">
            {counts.slice(0, 3).map(({ emoji }, i) => (
              <span key={emoji} className={i > 0 ? '-ml-1' : ''}>
                {emoji}
              </span>
            ))}
          </span>
          <span className="ml-1 text-xs font-semibold text-zinc-300">{reactions.length}</span>
        </button>
      )}
      {canReact && (
        <button
          aria-label={mine ? `Ma réaction ${mine}, appui long pour changer` : 'Réagir, appui long pour choisir'}
          className={`relative z-40 flex size-8 items-center justify-center rounded-full text-base leading-none select-none [-webkit-touch-callout:none] ${
            mine ? 'bg-lime-400/20 ring-1 ring-lime-400/60' : 'bg-zinc-950 grayscale opacity-60'
          }`}
          onPointerDown={pressStart}
          onPointerUp={pressEnd}
          onPointerLeave={pressEnd}
          onPointerCancel={pressEnd}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            if (longPressed.current) return
            react(mine ? null : DEFAULT_REACTION)
          }}
        >
          {mine ?? DEFAULT_REACTION}
        </button>
      )}

      {picking && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setPicking(false)} />
          <div className="absolute top-full right-0 z-30 mt-1 flex items-center gap-1 rounded-full bg-zinc-800 p-1.5 shadow-xl shadow-black">
            {PICKER_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className={`flex size-10 items-center justify-center rounded-full text-2xl leading-none ${emoji === mine ? 'bg-lime-400/20' : ''}`}
                onClick={() => react(emoji === mine ? null : emoji)}
              >
                {emoji}
              </button>
            ))}
            {custom ? (
              <input
                autoFocus
                aria-label="Choisir un emoji"
                placeholder="🙂"
                className="w-12 rounded-full border border-lime-400 bg-zinc-950 px-2 py-1.5 text-center text-lg"
                onChange={(e) => {
                  const emoji = firstEmoji(e.target.value)
                  if (emoji) react(emoji)
                }}
              />
            ) : (
              <button
                aria-label="Autre emoji"
                className="flex size-10 items-center justify-center rounded-full text-xl text-zinc-400"
                onClick={() => setCustom(true)}
              >
                +
              </button>
            )}
          </div>
        </>
      )}

      {who && <WhoReacted reactions={reactions} counts={counts} onClose={() => setWho(false)} />}
    </div>
  )
}

/** Who reacted, with a tab per emoji (like Facebook). */
function WhoReacted({
  reactions,
  counts,
  onClose,
}: {
  reactions: Reaction[]
  counts: { emoji: string; count: number }[]
  onClose: () => void
}) {
  const [tab, setTab] = useState<string | null>(null)
  const shown = reactions.filter((r) => tab === null || r.emoji === tab)
  const tabClass = (on: boolean) => `shrink-0 rounded-full px-3 py-1 text-sm ${on ? 'bg-lime-400/20 text-lime-300' : 'text-zinc-400'}`
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 lg:items-center lg:justify-center" onClick={onClose}>
      <div
        className="flex max-h-[70vh] w-full flex-col rounded-t-2xl bg-zinc-900 pb-[env(safe-area-inset-bottom)] lg:w-[26rem] lg:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 p-3">
          <button className={tabClass(tab === null)} onClick={() => setTab(null)}>
            Tous {reactions.length}
          </button>
          {counts.map(({ emoji, count }) => (
            <button key={emoji} className={tabClass(tab === emoji)} onClick={() => setTab(emoji)}>
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
      </div>
    </div>
  )
}
