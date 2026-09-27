import { useCallback, useEffect, useState, type DragEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ProgramBadges, type BadgeAssignment } from '../../components/ProgramBadges'
import { Button, Card, ErrorText, PageTitle } from '../../components/ui'
import { addDays, formatDay, formatWeek, fromISODate, fromLocalInput, mondayOf, today, weekDays } from '../../domain/dates'
import { getItem, setItem } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { searchExercises } from '../exercises/useExercises'
import { useTeam } from '../programs/useTeam'
import { StatusBadge } from './StatusBadge'

type Row = { id: string; title: string; date: string; publish_at: string | null; workout_assignments: BadgeAssignment[] }
type Panel = { kind: 'publish' | 'duplicate'; monday: string; weeks: number } | null

const WEEKS_KEY = 'planningWeeks'
const WEEK_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8]
const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches
const DAY_LETTERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/**
 * Coach planning over N weeks (N remembered on the device; 6 by default on desktop, 1 on mobile).
 * Desktop: one row of 7 day columns per week; drag a workout to move it, Alt/Option-drag to duplicate it.
 */
export function CalendarPage() {
  const [params, setParams] = useSearchParams()
  const monday = mondayOf(params.get('week') ?? today())
  const [weeks, setWeeksState] = useState(() => Number(getItem(WEEKS_KEY)) || (isDesktop() ? 6 : 1))
  const mondays = Array.from({ length: weeks }, (_, i) => addDays(monday, 7 * i))
  const end = addDays(monday, 7 * weeks - 1)
  const { members } = useTeam()
  const [rows, setRows] = useState<Row[]>([])
  const [adding, setAdding] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [dropDay, setDropDay] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('workouts')
      .select('id, title, date, publish_at, workout_assignments(program_id, athlete_id, programs(name))')
      .gte('date', monday)
      .lte('date', end)
      .order('date')
      .order('created_at')
    setError(error?.message ?? '')
    setRows((data ?? []) as Row[])
  }, [monday, end])

  useEffect(() => {
    load()
  }, [load])

  const setWeeks = (n: number) => {
    setItem(WEEKS_KEY, String(n))
    setWeeksState(n)
  }
  const goWeek = (delta: number) => setParams({ week: addDays(monday, 7 * delta) }, { replace: true })
  const togglePanel = (p: NonNullable<Panel>) =>
    setPanel(panel && panel.kind === p.kind && panel.monday === p.monday && panel.weeks === p.weeks ? null : p)
  const inWeek = (m: string) => rows.filter((r) => r.date >= m && r.date <= addDays(m, 6))

  // Drag & drop (desktop). Alt / Option held on drop = duplicate instead of move.
  const onDragStart = (e: DragEvent, row: Row) => {
    e.dataTransfer.setData('text/plain', row.id)
    e.dataTransfer.effectAllowed = 'copyMove'
  }
  const onDragOver = (e: DragEvent, day: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move'
    setDropDay(day)
  }
  async function onDrop(e: DragEvent, day: string) {
    e.preventDefault()
    setDropDay(null)
    const id = e.dataTransfer.getData('text/plain')
    const row = rows.find((r) => r.id === id)
    if (!row) return
    const { error } = e.altKey
      ? await supabase.rpc('duplicate_workout', { p_id: id, p_date: day })
      : row.date === day
        ? { error: null }
        : await supabase.rpc('move_workout', { p_id: id, p_date: day })
    setError(error?.message ?? '')
    load()
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Programmation</PageTitle>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Afficher
          <select
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-zinc-100"
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
          >
            {WEEK_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n} semaine{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <button className="px-3 py-2 text-xl text-zinc-400" onClick={() => goWeek(-1)} aria-label="Semaine précédente">
          ‹
        </button>
        <button className="font-semibold" onClick={() => setParams({}, { replace: true })}>
          {weeks === 1 ? formatWeek(monday) : `${formatWeek(monday).split(' – ')[0]} – ${formatWeek(addDays(end, -6)).split(' – ')[1]}`}
        </button>
        <button className="px-3 py-2 text-xl text-zinc-400" onClick={() => goWeek(1)} aria-label="Semaine suivante">
          ›
        </button>
      </div>

      {weeks > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="py-2 text-sm"
            disabled={rows.length === 0}
            onClick={() => togglePanel({ kind: 'duplicate', monday, weeks })}
          >
            Dupliquer les {weeks} semaines
          </Button>
          <p className="hidden self-center text-xs text-zinc-500 lg:block">
            Glisser une séance pour la déplacer · Alt (Option sur Mac) + glisser pour la dupliquer
          </p>
        </div>
      )}
      {panel?.weeks === weeks && weeks > 1 && panel.kind === 'duplicate' && (
        <DuplicatePanel
          monday={monday}
          weeks={weeks}
          onDone={(to) => (setPanel(null), setParams({ week: to }, { replace: true }))}
        />
      )}
      <ErrorText>{error}</ErrorText>

      <div className="flex flex-col gap-6">
        {mondays.map((m, wi) => {
          const weekRows = inWeek(m)
          const drafts = weekRows.filter((r) => !r.publish_at).length
          const open = (kind: 'publish' | 'duplicate') => panel?.kind === kind && panel.monday === m && panel.weeks === 1
          return (
            <section key={m}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold tracking-widest text-zinc-400 uppercase">
                  {weeks > 1 && <span className="text-lime-400">S{wi + 1} · </span>}
                  {formatWeek(m)}
                </h2>
                <div className="flex gap-2">
                  <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => togglePanel({ kind: 'publish', monday: m, weeks: 1 })}>
                    Publier{drafts ? ` (${drafts})` : ''}
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    disabled={weekRows.length === 0}
                    onClick={() => togglePanel({ kind: 'duplicate', monday: m, weeks: 1 })}
                  >
                    Dupliquer
                  </Button>
                </div>
              </div>
              {open('publish') && <PublishWeek monday={m} drafts={drafts} onDone={() => (setPanel(null), load())} />}
              {open('duplicate') && (
                <DuplicatePanel monday={m} weeks={1} onDone={(to) => (setPanel(null), setParams({ week: to }, { replace: true }))} />
              )}

              <div className="flex flex-col gap-2 lg:grid lg:grid-cols-7">
                {weekDays(m).map((day, di) => (
                  <div
                    key={day}
                    onDragOver={(e) => onDragOver(e, day)}
                    onDragLeave={() => setDropDay((d) => (d === day ? null : d))}
                    onDrop={(e) => onDrop(e, day)}
                    className={`rounded-2xl bg-zinc-900 p-3 lg:min-h-32 lg:p-2 ${day === today() ? 'ring-1 ring-lime-400/50' : ''} ${
                      dropDay === day ? 'bg-zinc-800 ring-2 ring-lime-400' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-400 capitalize">
                        <span className="lg:hidden">{formatDay(day)}</span>
                        <span className="hidden lg:inline">
                          {DAY_LETTERS[di]} {fromISODate(day).getDate()}
                        </span>
                      </span>
                      <button className="-m-2 p-2 text-xl text-lime-400" onClick={() => setAdding(day)} aria-label="Ajouter">
                        +
                      </button>
                    </div>
                    {weekRows
                      .filter((r) => r.date === day)
                      .map((r) => (
                        <Link
                          key={r.id}
                          to={`/calendar/workouts/${r.id}`}
                          draggable
                          onDragStart={(e) => onDragStart(e, r)}
                          className="mt-2 block cursor-grab rounded-xl bg-zinc-950 p-3 active:cursor-grabbing lg:p-2"
                        >
                          <span className="block font-semibold lg:text-sm">{r.title}</span>
                          <span className="mt-1 flex flex-wrap items-center justify-between gap-1 lg:flex-col lg:items-start">
                            <ProgramBadges
                              assignments={r.workout_assignments}
                              athleteName={(id) => members.find((mb) => mb.id === id)?.display_name ?? undefined}
                            />
                            <StatusBadge publishAt={r.publish_at} />
                          </span>
                        </Link>
                      ))}
                  </div>
                ))}
              </div>
            </section>
          )
        })}
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
    <Card className="mb-3 flex flex-col gap-2 lg:max-w-md">
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

/** Copies `weeks` consecutive weeks starting at `monday` to the weeks starting at the chosen date. */
function DuplicatePanel({ monday, weeks, onDone }: { monday: string; weeks: number; onDone: (to: string) => void }) {
  const [to, setTo] = useState(addDays(monday, 7 * weeks))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const target = to ? mondayOf(to) : null
  // Source and target periods must not overlap (copies would be copied again).
  const overlaps = !!target && target > addDays(monday, -7 * weeks) && target < addDays(monday, 7 * weeks)

  async function apply() {
    setBusy(true)
    for (let i = 0; i < weeks; i++) {
      const { error } = await supabase.rpc('duplicate_week', { p_from: addDays(monday, 7 * i), p_to: addDays(target!, 7 * i) })
      if (error) {
        setBusy(false)
        return setError(error.message)
      }
    }
    onDone(target!)
  }

  return (
    <Card className="mb-3 flex flex-col gap-2 lg:max-w-md">
      <p className="text-sm text-zinc-400">
        Copier {weeks > 1 ? `les ${weeks} semaines` : 'la semaine'} vers la semaine du (cibles conservées, publication
        décalée d’autant) :
      </p>
      <input
        type="date"
        className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      {overlaps && weeks > 1 && <p className="text-sm text-amber-400">La période cible chevauche la période copiée.</p>}
      <Button disabled={!target || overlaps || busy} onClick={apply}>
        Dupliquer vers la semaine du {target ? formatDay(target) : '…'}
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
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black pt-[env(safe-area-inset-top)]">
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
