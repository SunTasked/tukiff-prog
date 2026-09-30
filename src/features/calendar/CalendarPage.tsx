import { Fragment, useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { DateField, DateTimeField } from '../../components/DatePicker'
import { ProgramBadge, programColor } from '../../components/ProgramBadges'
import { Button, ErrorText, PageTitle } from '../../components/ui'
import {
  addDays,
  coversDay,
  formatDay,
  formatWeek,
  fromISODate,
  fromLocalInput,
  lastDay,
  mondayOf,
  today,
  weekDays,
} from '../../domain/dates'
import { compareWorkouts } from '../../domain/grouping'
import { groupBySection } from '../../domain/sections'
import { getItem, setItem } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { searchExercises } from '../exercises/useExercises'
import { useMyPrograms, type EditableProgram } from '../programs/useMyPrograms'
import { StatusBadge } from './StatusBadge'

type Row = { id: string; title: string; date: string; days: number; publish_at: string | null; program_id: string }

const WEEKS_KEY = 'planningWeeks'
const FILTER_KEY = 'planningPrograms'
const WEEK_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8]
const DAY_LETTERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches
const daysBetween = (from: string, to: string) => Math.round((fromISODate(to).getTime() - fromISODate(from).getTime()) / 86_400_000)

function readFilter(): string[] {
  try {
    return JSON.parse(getItem(FILTER_KEY) ?? '[]')
  } catch {
    return []
  }
}

/**
 * Coach planning over N weeks, limited to the programs the coach owns or contributes to (filterable).
 * Tap/click workouts to select them (day title: whole day, double click: whole week), then act on the
 * selection. Desktop: drag to move, Alt/Option-drag to duplicate (the whole selection if the card is selected).
 */
export function CalendarPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const monday = mondayOf(params.get('week') ?? today())
  const [weeks, setWeeksState] = useState(() => Number(getItem(WEEKS_KEY)) || (isDesktop() ? 6 : 1))
  const end = addDays(monday, 7 * weeks - 1)
  const { programs } = useMyPrograms()
  const [filter, setFilterState] = useState<string[]>(readFilter)
  const [rows, setRows] = useState<Row[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)
  const [dropDay, setDropDay] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Shown programs: the filter (ignoring programs no longer editable), or all when empty.
  const shownIds = useMemo(() => {
    const mine = (programs ?? []).map((p) => p.id)
    const f = filter.filter((id) => mine.includes(id))
    return f.length ? f : mine
  }, [programs, filter])
  const programById = useMemo(() => new Map((programs ?? []).map((p) => [p.id, p])), [programs])

  const load = useCallback(async () => {
    if (!programs) return
    if (!shownIds.length) return setRows([])
    const { data, error } = await supabase
      .from('workouts')
      .select('id, title, date, days, publish_at, program_id')
      .in('program_id', shownIds)
      // 6 days earlier: multi-day workouts started last week still run this week.
      .gte('date', addDays(monday, -6))
      .lte('date', end)
      .order('date')
      .order('created_at')
    setError(error?.message ?? '')
    const name = (r: Row) => programById.get(r.program_id)?.name ?? ''
    setRows(
      ((data ?? []) as Row[])
        .filter((r) => lastDay(r.date, r.days) >= monday)
        // Within a day: program A→Z, then title, then publish time.
        .sort((a, b) => compareWorkouts({ ...a, program: name(a) }, { ...b, program: name(b) })),
    )
  }, [programs, programById, shownIds, monday, end])

  useEffect(() => {
    load()
  }, [load])

  // Keep only visible workouts in the selection.
  useEffect(() => {
    setSelected((s) => new Set([...s].filter((id) => rows.some((r) => r.id === id))))
  }, [rows])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(new Set())
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const setWeeks = (n: number) => {
    setItem(WEEKS_KEY, String(n))
    setWeeksState(n)
  }
  const setFilter = (ids: string[]) => {
    setItem(FILTER_KEY, JSON.stringify(ids))
    setFilterState(ids)
  }
  const toggleFilter = (id: string) =>
    setFilter(filter.includes(id) ? filter.filter((x) => x !== id) : [...filter, id])
  const goWeek = (delta: number) => setParams({ week: addDays(monday, 7 * delta) }, { replace: true })

  // Selection ----------------------------------------------------------------------------
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  /** Selects the given workouts, or unselects them if they are all selected already. */
  const toggleMany = (ids: string[]) =>
    setSelected((s) => {
      const n = new Set(s)
      const all = ids.length > 0 && ids.every((id) => n.has(id))
      for (const id of ids) {
        if (all) n.delete(id)
        else n.add(id)
      }
      return n
    })
  const selectMany = (ids: string[]) => setSelected((s) => new Set([...s, ...ids]))
  const idsOn = (from: string, to: string) => rows.filter((r) => r.date >= from && r.date <= to).map((r) => r.id)

  // Drag & drop (desktop) -------------------------------------------------------------------
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
    const row = rows.find((r) => r.id === e.dataTransfer.getData('text/plain'))
    if (!row) return
    const ids = selected.has(row.id) ? [...selected] : [row.id]
    const days = daysBetween(row.date, day)
    if (!e.altKey && days === 0) return
    const { error } = e.altKey
      ? await supabase.rpc('duplicate_workouts', { p_ids: ids, p_days: days })
      : await supabase.rpc('move_workouts', { p_ids: ids, p_days: days })
    setError(error?.message ?? '')
    load()
  }

  if (programs && programs.length === 0) {
    return (
      <>
        <PageTitle>Programmation</PageTitle>
        <p className="text-zinc-400">
          Tu n’as encore aucune programmation. Crée-en une dans l’onglet <b>Communauté</b>.
        </p>
      </>
    )
  }

  return (
    <div className={selected.size ? 'pb-40 lg:pb-24' : ''}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
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

      {/* Program filter: none selected = all my programs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${filter.length === 0 ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}
          onClick={() => setFilter([])}
        >
          Toutes
        </button>
        {(programs ?? []).map((p) => (
          <button
            key={p.id}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              filter.includes(p.id) ? programColor(p.name) + ' ring-1 ring-current' : 'bg-zinc-900 text-zinc-500'
            }`}
            onClick={() => toggleFilter(p.id)}
          >
            {p.name}
            {!p.isOwner && <span className="ml-1 text-xs opacity-70">(contrib.)</span>}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <button className="px-3 py-2 text-xl text-zinc-400" onClick={() => goWeek(-1)} aria-label="Semaine précédente">
          ‹
        </button>
        <button className="font-semibold" onClick={() => setParams({}, { replace: true })}>
          {formatWeek(monday).split(' – ')[0]} – {formatWeek(addDays(end, -6)).split(' – ')[1]}
        </button>
        <button className="px-3 py-2 text-xl text-zinc-400" onClick={() => goWeek(1)} aria-label="Semaine suivante">
          ›
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        <button className="rounded-full bg-zinc-800 px-3 py-1.5 font-semibold text-zinc-200" onClick={() => selectMany(idsOn(monday, end))}>
          Tout sélectionner
        </button>
        <span className="hidden lg:inline">
          Clic : sélectionner · Double-clic : ouvrir · Clic sur un jour : tout le jour · Double-clic : toute la semaine ·
          Glisser : déplacer · Alt/Option + glisser : dupliquer
        </span>
      </div>
      <ErrorText>{error}</ErrorText>

      <div className="flex flex-col gap-6">
        {Array.from({ length: weeks }, (_, wi) => addDays(monday, 7 * wi)).map((m, wi) => (
          <section key={m}>
            <h2 className="mb-2 text-sm font-semibold tracking-widest text-zinc-400 uppercase">
              {weeks > 1 && <span className="text-lime-400">S{wi + 1} · </span>}
              {formatWeek(m)}
            </h2>
            <div className="flex flex-col gap-2 lg:grid lg:grid-cols-7">
              {weekDays(m).map((day, di) => {
                const dayRows = rows.filter((r) => r.date === day)
                // Multi-day workouts running on this day but started earlier: a faded reminder line.
                const running = rows.filter((r) => r.date < day && coversDay(r.date, r.days, day))
                // One group per program (rows are already A→Z): its cards, multi-day ones last, then its reminders.
                const groups = [...new Set([...dayRows, ...running].map((r) => r.program_id))]
                  .sort((x, y) => rows.findIndex((r) => r.program_id === x) - rows.findIndex((r) => r.program_id === y))
                  .map((id) => ({
                    id,
                    cards: dayRows.filter((r) => r.program_id === id).sort((x, y) => Number(x.days > 1) - Number(y.days > 1)),
                    running: running.filter((r) => r.program_id === id),
                  }))
                return (
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
                      <button
                        className="-m-1 rounded-lg p-1 text-left text-sm font-semibold text-zinc-400 capitalize select-none hover:text-zinc-100"
                        title="Clic : sélectionner le jour · Double-clic : la semaine"
                        onClick={() => toggleMany(dayRows.map((r) => r.id))}
                        onDoubleClick={() => selectMany(idsOn(m, addDays(m, 6)))}
                      >
                        <span className="lg:hidden">{formatDay(day)}</span>
                        <span className="hidden lg:inline">
                          {DAY_LETTERS[di]} {fromISODate(day).getDate()}
                        </span>
                      </button>
                      <button className="-m-2 p-2 text-xl text-lime-400" onClick={() => setAdding(day)} aria-label="Ajouter">
                        +
                      </button>
                    </div>
                    {groups.map((g) => (
                      <Fragment key={g.id}>
                        {g.cards.length === 0 && (
                          <div className="mt-2 rounded-xl border border-dashed border-zinc-800 p-3 lg:p-2">
                            <ProgramBadge name={programById.get(g.id)?.name ?? ''} />
                            <span className="mt-1 block text-xs text-zinc-500">Aucune séance</span>
                          </div>
                        )}
                        {g.cards.map((r) => {
                          const isSel = selected.has(r.id)
                          const program = programById.get(r.program_id)
                          return (
                            <div
                              key={r.id}
                              role="button"
                              tabIndex={0}
                              draggable
                              onDragStart={(e) => onDragStart(e, r)}
                              onClick={() => toggle(r.id)}
                              onDoubleClick={() => navigate(`/calendar/workouts/${r.id}`)}
                              className={`relative mt-2 block cursor-pointer rounded-xl p-3 select-none lg:p-2 ${
                                isSel ? 'bg-lime-400/10 ring-2 ring-lime-400' : 'bg-zinc-950'
                              }`}
                            >
                              {isSel && (
                                <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-lime-400 text-xs font-bold text-zinc-950">
                                  ✓
                                </span>
                              )}
                              {program && (
                                <span className="block pr-5">
                                  <ProgramBadge name={program.name} />
                                </span>
                              )}
                              <span className="mt-1 block pr-5 font-semibold lg:text-sm">{r.title}</span>
                              {r.days > 1 && (
                                <span className="mt-0.5 block text-xs text-amber-300">
                                  🗓 {r.days} jours · jusqu’au {formatDay(lastDay(r.date, r.days))}
                                </span>
                              )}
                              <span className="mt-1 block text-xs">
                                <StatusBadge publishAt={r.publish_at} />
                              </span>
                            </div>
                          )
                        })}
                        {g.running.map((r) => (
                          <button
                            key={r.id}
                            className="mt-2 block w-full truncate rounded-xl border border-dashed border-amber-300/30 px-3 py-1.5 text-left text-xs text-amber-200/70 lg:px-2"
                            onClick={() => navigate(`/calendar/workouts/${r.id}`)}
                          >
                            ↳ {r.title} · jusqu’au {formatDay(lastDay(r.date, r.days))}
                          </button>
                        ))}
                      </Fragment>
                    ))}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {selected.size > 0 && (
        <SelectionBar
          rows={rows.filter((r) => selected.has(r.id))}
          programs={programs ?? []}
          onClear={() => setSelected(new Set())}
          onOpen={(id) => navigate(`/calendar/workouts/${id}`)}
          onDone={() => load()}
        />
      )}

      {adding && programs && (
        <AddSheet
          date={adding}
          programs={programs.filter((p) => shownIds.includes(p.id))}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  )
}

type Action = 'publish' | 'duplicate' | null
type DuplicateMode = 'same' | 'other'

/** Actions on the selected workouts. Every action opens a panel that can be cancelled. */
function SelectionBar({
  rows,
  programs,
  onClear,
  onOpen,
  onDone,
}: {
  rows: Row[]
  programs: EditableProgram[]
  onClear: () => void
  onOpen: (id: string) => void
  onDone: () => void
}) {
  const [action, setAction] = useState<Action>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ids = rows.map((r) => r.id)
  const first = rows.map((r) => r.date).sort()[0]
  const [publishAt, setPublishAt] = useState(`${mondayOf(first)}T07:00`)
  const [target, setTarget] = useState(addDays(first, 7))
  const [mode, setMode] = useState<DuplicateMode>('same')
  const sourceIds = [...new Set(rows.map((r) => r.program_id))]
  const others = programs.filter((p) => p.id !== sourceIds[0])
  const [targetProgram, setTargetProgram] = useState('')
  const drafts = rows.filter((r) => !r.publish_at).length

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    const { error } = await p
    setBusy(false)
    if (error) return setError(error.message)
    setError('')
    setAction(null)
    onDone()
  }
  const publish = (value: string | null) => run(supabase.from('workouts').update({ publish_at: value }).in('id', ids))
  async function remove() {
    if (!confirm(`Supprimer ${ids.length} séance${ids.length > 1 ? 's' : ''} ? Les scores saisis seront supprimés.`)) return
    await run(supabase.from('workouts').delete().in('id', ids))
    onClear()
  }

  const chooseMode = (m: DuplicateMode) => {
    setMode(m)
    setTarget(m === 'same' ? addDays(first, 7) : first)
    setTargetProgram(m === 'other' ? (others[0]?.id ?? '') : '')
  }
  const duplicate = () =>
    run(
      supabase.rpc('duplicate_workouts', {
        p_ids: ids,
        p_days: daysBetween(first, target),
        ...(mode === 'other' ? { p_program: targetProgram } : {}),
      }),
    )

  const panel = 'flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3'
  const input = 'rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2'

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 px-3 lg:bottom-4 lg:left-56 lg:px-8">
      <div className="mx-auto flex max-h-[75dvh] max-w-4xl flex-col gap-3 overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900/95 p-3 shadow-2xl shadow-black backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto font-semibold">
            {ids.length} sélectionnée{ids.length > 1 ? 's' : ''}
          </span>
          {ids.length === 1 && (
            <Button className="px-3 py-2 text-sm" onClick={() => onOpen(ids[0])}>
              Modifier
            </Button>
          )}
          <Button variant="secondary" className="px-3 py-2 text-sm" onClick={() => setAction(action === 'publish' ? null : 'publish')}>
            Publier
          </Button>
          <Button variant="secondary" className="px-3 py-2 text-sm" onClick={() => setAction(action === 'duplicate' ? null : 'duplicate')}>
            Dupliquer
          </Button>
          <Button variant="danger" className="px-3 py-2 text-sm" disabled={busy} onClick={remove}>
            Supprimer
          </Button>
          <button className="px-2 text-zinc-400" onClick={onClear} aria-label="Vider la sélection" title="Vider la sélection (Échap)">
            ✕
          </button>
        </div>

        {action === 'publish' && (
          <div className={panel}>
            <span className="text-sm text-zinc-400">Publier le</span>
            <DateTimeField value={publishAt} onChange={setPublishAt} />
            <Button className="px-3 py-2 text-sm" disabled={!publishAt || busy} onClick={() => publish(fromLocalInput(publishAt))}>
              Programmer
            </Button>
            <Button variant="secondary" className="px-3 py-2 text-sm" disabled={busy} onClick={() => publish(new Date().toISOString())}>
              Maintenant
            </Button>
            <Button variant="secondary" className="px-3 py-2 text-sm" disabled={busy} onClick={() => publish(null)}>
              Brouillon{drafts < ids.length ? '' : ' ✓'}
            </Button>
            <Button variant="secondary" className="px-3 py-2 text-sm" onClick={() => setAction(null)}>
              Annuler
            </Button>
          </div>
        )}

        {action === 'duplicate' && sourceIds.length > 1 && (
          <div className={panel}>
            <span className="text-sm text-zinc-400">
              Sélectionne des séances d’une seule programmation pour les dupliquer.
            </span>
            <Button variant="secondary" className="px-3 py-2 text-sm" onClick={() => setAction(null)}>
              Annuler
            </Button>
          </div>
        )}

        {action === 'duplicate' && sourceIds.length === 1 && (
          <div className={panel}>
            <div className="flex w-full gap-1.5">
              {(['same', 'other'] as const).map((m) => (
                <button
                  key={m}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${mode === m ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}
                  onClick={() => chooseMode(m)}
                >
                  {m === 'same' ? 'Même programmation' : 'Autre programmation'}
                </button>
              ))}
            </div>
            {mode === 'other' &&
              (others.length ? (
                <select className={input} value={targetProgram} onChange={(e) => setTargetProgram(e.target.value)}>
                  {others.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-zinc-400">Aucune autre programmation modifiable.</span>
              ))}
            <span className="w-full text-sm text-zinc-400">
              À partir du (la 1ʳᵉ séance du {formatDay(first)} y sera placée, les autres gardent leur écart)
            </span>
            <DateField value={target} onChange={setTarget} />
            <span className="text-xs text-zinc-500">
              {target ? `décalage de ${daysBetween(first, target)} jour(s)` : ''}
            </span>
            <Button
              className="px-3 py-2 text-sm"
              disabled={!target || busy || (mode === 'other' && !targetProgram)}
              onClick={duplicate}
            >
              Dupliquer
            </Button>
            <Button variant="secondary" className="px-3 py-2 text-sm" onClick={() => setAction(null)}>
              Annuler
            </Button>
          </div>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  )
}

/** Pick a library template (copied to the date) or start a blank workout, in one of my programs. */
function AddSheet({ date, programs, onClose }: { date: string; programs: EditableProgram[]; onClose: () => void }) {
  const navigate = useNavigate()
  const [programId, setProgramId] = useState(programs[0]?.id ?? '')
  const [templates, setTemplates] = useState<{ id: string; name: string; title: string; section_id: string | null }[]>([])
  const [sections, setSections] = useState<{ id: string; name: string }[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('workouts')
      .select('id, title, section_id')
      .is('date', null)
      .then(({ data }) => setTemplates((data ?? []).map((w) => ({ ...w, name: w.title }))))
    supabase
      .from('library_sections')
      .select('id, name')
      .then(({ data }) => setSections(data ?? []))
  }, [])

  async function pick(id: string) {
    const { data, error } = await supabase.rpc('schedule_workout', { p_template: id, p_date: date, p_program: programId })
    if (error) return setError(error.message)
    navigate(`/calendar/workouts/${data}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 pt-[env(safe-area-inset-top)] lg:inset-auto lg:top-[8vh] lg:left-1/2 lg:h-[84vh] lg:w-[34rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-zinc-800 lg:shadow-2xl lg:shadow-black">
      <div className="flex items-center justify-between border-b border-zinc-800 p-3">
        <span className="font-semibold capitalize">{formatDay(date)}</span>
        <button className="px-2 text-zinc-400" onClick={onClose}>
          Annuler
        </button>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Programmation
          <select
            className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
          >
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={!programId} onClick={() => navigate(`/library/workouts/new?date=${date}&program=${programId}`)}>
          Nouvelle séance vierge
        </Button>
        <input
          placeholder="Ou choisir dans la bibliothèque…"
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 outline-none focus:border-lime-400"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ErrorText>{error}</ErrorText>
      </div>
      <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {groupBySection(searchExercises(templates, query), sections)
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.id ?? 'none'}>
              <p className="sticky top-0 bg-zinc-950 px-4 pt-3 pb-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                {g.name}
              </p>
              <ul>
                {g.items.map((t) => (
                  <li key={t.id}>
                    <button
                      className="w-full border-b border-zinc-900 px-4 py-3 text-left disabled:opacity-50"
                      disabled={!programId}
                      onClick={() => pick(t.id)}
                    >
                      {t.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </div>
  )
}

