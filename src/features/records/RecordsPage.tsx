import { Link } from 'react-router'
import { PageTitle } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useExercises } from '../exercises/useExercises'
import { RecordsList } from './RecordsList'
import { useRecords } from './useRecords'

/** My best records, read-only: they are entered (and corrected) from the library pages. */
export function RecordsPage() {
  const { session } = useAuth()
  const { nameOf, measureOf } = useExercises()
  const { records, loads } = useRecords(session?.user.id)

  return (
    <>
      <Link to="/profile" className="text-sm text-zinc-400">
        ‹ Profil
      </Link>
      <PageTitle>Mes records</PageTitle>
      <p className="mb-4 text-sm text-zinc-400">
        Pour saisir ou corriger un record, ouvre l’exercice ou le benchmark dans la{' '}
        <Link to="/library" className="text-lime-400 underline">
          bibliothèque
        </Link>
        .
      </p>
      <RecordsList records={records} loads={loads} nameOf={nameOf} measureOf={measureOf} linked />
    </>
  )
}
