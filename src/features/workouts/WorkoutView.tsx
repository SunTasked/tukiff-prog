import { useState } from 'react'
import { getItem, setItem } from '../../lib/storage'
import { Chips } from '../../components/ui'
import {
  BLOCK_KINDS,
  LEVELS,
  formatSummary,
  itemSummary,
  resolveItem,
  type Level,
  type WorkoutDraft,
} from '../../domain/workout'

/** Read-only rendering of a workout, with a level selector (Elite / RX / Scaled / Foundation). */
export function WorkoutView({
  workout,
  nameOf,
  videoOf,
}: {
  workout: WorkoutDraft
  nameOf: (id: string) => string | undefined
  videoOf?: (id: string) => string | null | undefined
}) {
  // Remember the athlete's usual level on this device.
  const [level, setLevelState] = useState<Level>(() => {
    const saved = getItem('level')
    return saved && saved in LEVELS ? (saved as Level) : 'rx'
  })
  const setLevel = (l: Level) => {
    setItem('level', l)
    setLevelState(l)
  }
  const hasLevels = workout.blocks.some((b) => b.items.some((i) => Object.keys(i.levels).length > 0))

  return (
    <div className="flex flex-col gap-4">
      {workout.notes && <p className="whitespace-pre-line text-zinc-300">{workout.notes}</p>}
      {hasLevels && <Chips options={LEVELS} value={level} onChange={setLevel} />}
      {workout.blocks.map((b, i) => (
        <section key={b.id} className="rounded-2xl bg-zinc-900 p-4">
          <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            {String.fromCharCode(65 + i)} · {BLOCK_KINDS[b.kind]}
          </p>
          {(b.title || formatSummary(b.format, b.params)) && (
            <h3 className="mt-1 text-lg font-bold">
              {[b.title, formatSummary(b.format, b.params)].filter(Boolean).join(' — ')}
            </h3>
          )}
          <ul className="mt-2 flex flex-col gap-1">
            {b.items.map((item, j) => {
              const r = resolveItem(item, level)
              const video = r.exercise_id && videoOf?.(r.exercise_id)
              return (
                <li key={j}>
                  {itemSummary(r, nameOf)}
                  {video && (
                    <a href={video} target="_blank" rel="noreferrer" className="ml-2 text-sm text-lime-400">
                      ▶ vidéo
                    </a>
                  )}
                  {r.notes && <span className="block text-sm text-zinc-400">{r.notes}</span>}
                </li>
              )
            })}
          </ul>
          {b.notes && <p className="mt-2 text-sm whitespace-pre-line text-zinc-400">{b.notes}</p>}
        </section>
      ))}
    </div>
  )
}
