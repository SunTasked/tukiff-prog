import { Markdown } from '../../components/Markdown'
import { SCORE_TYPES, scoreType } from '../../domain/scoring'
import {
  BLOCK_KINDS,
  formatSummary,
  isPremium,
  itemRuns,
  itemSummary,
  levelName,
  type AccessLevel,
  type BlockDraft,
} from '../../domain/workout'

/** Zoom of the planning cards, from a one-line title to the blocks' full content. */
export const DETAILS = { title: 'Titre', session: 'Séance', blocks: 'Blocs', full: 'Complet' } as const
export type Detail = keyof typeof DETAILS

/** Blocks of a planning card: one line each ("blocks"), or with their movements, text and score ("full"). */
export function BlockLines({
  blocks,
  levels,
  full,
  nameOf,
}: {
  blocks: BlockDraft[]
  levels: AccessLevel[] | undefined
  full: boolean
  nameOf: (id: string) => string | undefined
}) {
  if (!blocks.length) return <span className="mt-1 block text-xs text-zinc-600 italic">Aucun bloc</span>
  return (
    <ol className="mt-2 flex flex-col gap-1.5 border-t border-zinc-800 pt-2 text-xs">
      {blocks.map((b, i) => {
        const head = [b.title, formatSummary(b.format, b.params)].filter(Boolean).join(' — ')
        const score = scoreType(b.format, b.params)
        return (
          <li key={b.id} className="min-w-0">
            <p className={full ? '' : 'truncate'}>
              <span className="font-semibold text-zinc-500">
                {String.fromCharCode(65 + i)} · {BLOCK_KINDS[b.kind]}
              </span>
              {head && <span className="text-zinc-200"> {head}</span>}
              {isPremium(b) && (
                <span className="ml-1 rounded bg-amber-400/15 px-1 whitespace-nowrap text-amber-300">
                  {levelName(levels, b.params.min_level!)}
                </span>
              )}
            </p>
            {full && (
              <div className="mt-0.5 border-l border-zinc-800 pl-2 text-zinc-400">
                {b.format === 'none' && b.notes && <Markdown text={b.notes} className="text-zinc-400" />}
                {itemRuns(b).map(({ group, items }, k) => (
                  <div key={k} className={group === null ? '' : 'my-0.5'}>
                    {group !== null && b.groups[group].title && (
                      <p className="font-semibold text-lime-400/80">{b.groups[group].title}</p>
                    )}
                    {items.map(({ item, index }) => (
                      <p key={index} className={group === null ? '' : 'pl-2'}>
                        {itemSummary(item, nameOf)}
                      </p>
                    ))}
                    {group !== null && b.groups[group].note && <p className="pl-2">↻ {b.groups[group].note}</p>}
                  </div>
                ))}
                {b.format !== 'none' && b.notes && <p className="whitespace-pre-line text-zinc-500">{b.notes}</p>}
                {score !== 'none' && (
                  <p className="text-zinc-500">
                    Score : {SCORE_TYPES[score]}
                    {b.params.ranked === false && ' · hors classement'}
                  </p>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
