import { formatDateTime, publicationStatus } from '../../domain/dates'

export function StatusBadge({ publishAt }: { publishAt: string | null }) {
  const status = publicationStatus(publishAt)
  if (status === 'draft') return <span className="text-xs text-amber-400">Brouillon</span>
  if (status === 'scheduled') return <span className="text-xs text-sky-400">Publiée le {formatDateTime(publishAt!)}</span>
  return <span className="text-xs text-lime-400">Visible</span>
}
