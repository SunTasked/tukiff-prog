import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button, Card, ErrorText, PageTitle } from '../../components/ui'
import {
  addDays,
  formatDay,
  formatWeek,
  fromLocalInput,
  mondayOf,
  today,
  weekDays,
} from '../../domain/dates'
import { ProgramBadges, type BadgeAssignment } from '../../components/ProgramBadges'
import { supabase } from '../../lib/supabase'
import { searchExercises } from '../exercises/useExercises'
import { useTeam } from '../programs/useTeam'
import { StatusBadge } from './StatusBadge'

type Row = { id: string; title: string; date: string; publish_at: string | null; workout_assignments: BadgeAssignment[] }

export function CalendarPage() {
  const [params, setParams] = useSearchParams()
  const monday = mondayOf(params.get('week') ?? today())
  const days = weekDays(monday)
  const { members } = useTeam()
  const [rows, setRows] = useState<Row[]>([])
  const [adding, setAdding] = useState<string | null>(null)
  const [panel, setPanel] = useState<'publish' | 'duplicate' | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('workouts')
      .select('id, title, date, publish_at, workout_assignments(program_id, athlete_id, programs(name))')
      .gte('date', monday)
      .lte('date', addDays(monday, 6))
      .order('date')
      .order('created_at')
    setError(error?.message ?? '')
    setRows((data ?? []) as Row[])
  }, [monday])

  useEffect(() => {
    load()
  }, [load])

  const goWeek = (delta: number) => setParams({ week: addDays(monday, 7 * delta) }, { replace: true })
  const drafts = rows.filter((r) => !r.publish_at).length

  return (
    <>
      <PageTitle>Programmation</PageTitle>
      <div className="mb-3 flex items-center justify-between">
        <button className="px-3 py-2 text-xl text-zinc-400" onClick={() => goWeek(-1)} aria-label="Semaine précédente">
          ‹
        </button>
        <button className="font-semibold" onClick={() => setParams({}, { replace: true })}>
          {formatWeek(monday)}
        </button>
        <button className="px-3 py-2 text-xl text-zinc-400" onClick={() => goWeek(1)} aria-label="Semaine suivante">
          ›
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <Button variant="secondary" className="flex-1 py-2 text-sm" onClick={() => setPanel(panel === 'publish' ? null : 'publish')}>
          Publier la semaine{drafts ? ` (${drafts})` : ''}
        </Button>
        <Button
          variant="secondary"
          className="flex-1 py-2 text-sm"
          disabled={rows.length === 0}
          onClick={() => setPanel(panel === 'duplicate' ? null : 'duplicate')}
        >
          Dupliquer la semaine
        </Button>
      </div>
      {panel === 'publish' && <PublishWeek monday={monday} drafts={drafts} onDone={() => (setPanel(null), load())} />}
      {panel === 'duplicate' && (
        <DuplicateWeek monday={monday} onDone={(to) => (setPanel(null), setParams({ week: to }, { replace: true }))} />
      )}
      <ErrorText>{error}</ErrorText>

      <div className="flex flex-col gap-2">
        {days.map((day) => (
          <Card key={day} className={day === today() ? 'ring-1 ring-lime-400/50' : ''}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-400 capitalize">{formatDay(day)}</span>
              <button className="-m-2 p-2 text-xl text-lime-400" onClick={() => setAdding(day)} aria-label="Ajouter">
                +
              </button>
            </div>
            {rows
              .filter((r) => r.date === day)
              .map((r) => (
                <Link key={r.id} to={`/calendar/workouts/${r.id}`} className="mt-2 block rounded-xl bg-zinc-950 p-3">
                  <span className="block font-semibold">{r.title}</span>
                  <span className="mt-1 flex items-center justify-between gap-2">
                    <ProgramBadges
                      assignments={r.workout_assignments}
                      athleteName={(id) => members.find((m) => m.id === id)?.display_name ?? undefined}
                    />
                    <StatusBadge publishAt={r.publish_at} />
                  </span>
                </Link>
              ))}
          </Card>
        ))}
      </div>

      {adding && <AddSheet date={adding} onClose={() => setAdding(null)} />}
    </>
  )
}

function PublishWeek({ monday, drafts, onDone }: { monday: string; drafts: number; onDone: () => void }) {
  const [at, setAt] = useState(`${monday}T07:00`)
  const [error, setError] = useState('')

  async function apply() {
    const { error } = await supabase
      .from('workouts')
      .update({ publish_at: fromLocalInput(at) })
      .gte('date', monday)
      .lte('date', addDays(monday, 6))
      .is('publish_at', null)
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <Card className="mb-4 flex flex-col gap-2">
      <p className="text-sm text-zinc-400">
        Publier les {drafts} brouillon{drafts > 1 ? 's' : ''} de la semaine le :
      </p>
      <input
        type="datetime-local"
        className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
        value={at}
        onChange={(e) => setAt(e.target.value)}
      />
      <Button disabled={!drafts || !at} onClick={apply}>
        Valider
      </Button>
      <ErrorText>{error}</ErrorText>
    </Card>
  )
}

function DuplicateWeek({ monday, onDone }: { monday: string; onDone: (to: string) => void }) {
  const [to, setTo] = useState(addDays(monday, 7))
  const [error, setError] = useState('')

  async function apply() {
    const target = mondayOf(to)
    const { error } = await supabase.rpc('duplicate_week', { p_from: monday, p_to: target })
    if (error) setError(error.message)
    else onDone(target)
  }

  return (
    <Card className="mb-4 flex flex-col gap-2">
      <p className="text-sm text-zinc-400">
        Copier toutes les séances vers la semaine du (cibles conservées, publication décalée d’autant) :
      </p>
      <input
        type="date"
        className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <Button disabled={!to || mondayOf(to) === monday} onClick={apply}>
        Dupliquer vers la semaine du {to ? formatDay(mondayOf(to)) : '…'}
      </Button>
      <ErrorText>{error}</ErrorText>
    </Card>
  )
}

/** Pick a library template (copied to the date) or start a blank workout. */
function AddSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('workouts')
      .select('id, title')
      .is('date', null)
      .order('updated_at', { ascending: false })
      .then(({ data }) => setTemplates((data ?? []).map((w) => ({ id: w.id, name: w.title }))))
  }, [])

  async function pick(id: string) {
    const { data, error } = await supabase.rpc('schedule_workout', { p_template: id, p_date: date })
    if (error) return setError(error.message)
    navigate(`/calendar/workouts/${data}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between border-b border-zinc-800 p-3">
        <span className="font-semibold capitalize">{formatDay(date)}</span>
        <button className="px-2 text-zinc-400" onClick={onClose}>
          Annuler
        </button>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <Button onClick={() => navigate(`/library/workouts/new?date=${date}`)}>Nouvelle séance vierge</Button>
        <input
          placeholder="Ou choisir dans la bibliothèque…"
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-lime-400"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ErrorText>{error}</ErrorText>
      </div>
      <ul className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {searchExercises(templates, query).map((t) => (
          <li key={t.id}>
            <button className="w-full border-b border-zinc-900 px-4 py-3 text-left" onClick={() => pick(t.id)}>
              {t.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
