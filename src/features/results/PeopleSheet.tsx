import { Avatar } from '../../components/Avatar'

export type Person = {
  id: string
  profiles: { display_name: string | null; avatar_url: string | null } | null
  /** Shown right after the name (the emoji). */
  mark?: string
  /** My own row: removes my contribution. */
  onRemove?: () => void
}

/** Bottom sheet listing athletes (who reacted, who clapped), a "−" on my row to remove my contribution. */
export function PeopleSheet({
  title,
  people,
  onClose,
}: {
  title: string
  people: Person[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 lg:items-center lg:justify-center" onClick={onClose}>
      <div
        className="flex max-h-[75vh] w-full flex-col overflow-hidden rounded-t-2xl bg-zinc-900 pb-[env(safe-area-inset-bottom)] lg:w-[26rem] lg:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 p-3">
          <span className="font-semibold">{title}</span>
          <button className="px-2 text-zinc-400" onClick={onClose}>
            Fermer
          </button>
        </div>
        <ul className="flex flex-col gap-1 overflow-y-auto p-3">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-2 py-1.5">
              <Avatar url={p.profiles?.avatar_url} name={p.profiles?.display_name} className="size-7 text-[10px]" />
              <span className="min-w-0 truncate text-sm">{p.profiles?.display_name ?? '—'}</span>
              {p.mark && <span className="text-lg leading-none">{p.mark}</span>}
              {p.onRemove && (
                <button
                  aria-label="Retirer ma réaction"
                  className="flex size-6 items-center justify-center rounded-full bg-zinc-800 text-sm leading-none text-zinc-300"
                  onClick={p.onRemove}
                >
                  −
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
