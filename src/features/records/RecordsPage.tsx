import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button, PageTitle } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useExercises } from '../exercises/useExercises'
import { RecordSheet } from './RecordSheet'
import { RecordsList } from './RecordsList'
import { useRecords } from './useRecords'

export function RecordsPage() {
  const { session } = useAuth()
  const { nameOf } = useExercises()
  const { records, reload } = useRecords(session?.user.id)
  const [params, setParams] = useSearchParams()
  // ?add=<exercise_id> opens the form preset (link from a % of 1RM in a workout).
  const [adding, setAdding] = useState(params.has('add'))
  const close = () => {
    setAdding(false)
    setParams({}, { replace: true })
  }

  return (
    <>
      <Link to="/profile" className="text-sm text-zinc-400">
        ‹ Profil
      </Link>
      <PageTitle>Mes records</PageTitle>
      <Button className="mb-4 w-full" onClick={() => setAdding(true)}>
        + Nouveau record
      </Button>
      <RecordsList records={records} nameOf={nameOf} editable onChange={reload} />
      {adding && (
        <RecordSheet
          initialExercise={params.get('add') ?? undefined}
          onClose={close}
          onSaved={() => {
            close()
            reload()
          }}
        />
      )}
    </>
  )
}
