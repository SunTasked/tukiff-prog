import { useEffect, useMemo, useState } from 'react'
import { Chips, Spinner } from '../../components/ui'
import { addDays, formatDay, today } from '../../domain/dates'
import type { Gender } from '../../domain/profile'
import {
  buildReport,
  reportTotals,
  type ReportResult,
  type ReportRow,
  type ReportWorkout,
  type SessionStatus,
} from '../../domain/report'
import { isRanked, scoreType } from '../../domain/scoring'
import { formatSummary, type Format, type FormatParams } from '../../domain/workout'
import { supabase, type PersonalRecord } from '../../lib/supabase'

const PERIODS = { '7': '7 jours', '30': '30 jours' }
type Period = keyof typeof PERIODS

const STATUS: Record<SessionStatus, { label: string; className: string }> = {
  done: { label: 'Faite', className: 'bg-lime-400/15 text-lime-400' },
  partial: { label: 'Partielle', className: 'bg-amber-400/15 text-amber-400' },
  skipped: { label: 'Passée', className: 'bg-zinc-800 text-zinc-400' },
  missed: { label: 'Non faite', className: 'bg-zinc-800 text-zinc-400' },
}

type Data = { workouts: ReportWorkout[]; results: ReportResult[]; skipped: Set<string> }

/**
 * Coach view of what an athlete did: published sessions of the given programs (those the coach edits and
 * the athlete follows) over the period, with their scores, skips, ranks, comments and records.
 */
export function AthleteReport({
  athleteId,
  programs,
  records,
}: {
  athleteId: string
  /** level: the athlete's access level in the program (blocks above it are not theirs to do). */
  programs: { id: string; name: string; level: number }[]
  records: PersonalRecord[]
}) {
  const [period, setPeriod] = useState<Period>('7')
  const [program, setProgram] = useState('all')
  const [data, setData] = useState<Data | null>(null)
  const to = today()
  const from = addDays(to, 1 - Number(period))
  const programIds = useMemo(
    () => (program === 'all' ? programs.map((p) => p.id) : [program]),
    [program, programs],
  )

  useEffect(() => {
    let stale = false
    ;(async () => {
      setData(null)
      if (!programIds.length) return setData({ workouts: [], results: [], skipped: new Set() })
      const { data: rows } = await supabase
        .from('workouts')
        .select('id, title, date, program_id, programs(name), workout_blocks(id, position, kind, title, format, params, block_items(exercise_id))')
        .in('program_id', programIds)
        .gte('date', from)
        .lte('date', to)
        .lte('publish_at', new Date().toISOString())
      const workouts: ReportWorkout[] = (rows ?? []).map((w) => ({
        id: w.id,
        date: w.date!,
        title: w.title,
        program: w.programs?.name ?? '',
        blocks: [...w.workout_blocks]
          .sort((a, b) => a.position - b.position)
          .flatMap((b, i) => {
            const params = b.params as FormatParams
            if ((params.min_level ?? 0) > (programs.find((p) => p.id === w.program_id)?.level ?? 0)) return []
            const name = b.title || formatSummary(b.format as Format, params) || 'Bloc'
            return {
              id: b.id,
              label: `${String.fromCharCode(65 + i)} · ${name}`,
              type: scoreType(b.format as Format, params),
              ranked: isRanked(b.format as Format, params),
              team: !!params.team_size,
              exerciseIds: b.block_items.flatMap((it) => (it.exercise_id ? [it.exercise_id] : [])),
            }
          }),
      }))
      const ids = workouts.map((w) => w.id)
      const [res, skips] = ids.length
        ? await Promise.all([
            supabase.from('results').select('*, profiles(gender)').in('workout_id', ids),
            supabase.from('block_skips').select('block_id').in('workout_id', ids).eq('athlete_id', athleteId),
          ])
        : [{ data: [] }, { data: [] }]
      if (stale) return
      setData({
        workouts,
        results: (res.data ?? []).map((r) => ({ ...r, gender: (r.profiles?.gender ?? null) as Gender | null })),
        skipped: new Set((skips.data ?? []).map((s) => s.block_id)),
      })
    })()
    return () => {
      stale = true
    }
  }, [athleteId, programIds, from, to])

  const periodRecords = records.filter((r) => r.date >= from && r.date <= to)
  const sessions = data
    ? buildReport(athleteId, data.workouts, data.results, data.skipped, periodRecords)
    : null
  const totals = sessions && reportTotals(sessions, periodRecords)

  if (!programs.length)
    return <p className="text-sm text-zinc-400">Cet athlète ne suit aucune de tes programmations.</p>

  return (
    <div className="flex flex-col gap-3">
      <Chips options={PERIODS} value={period} onChange={setPeriod} />
      {programs.length > 1 && (
        <Chips
          options={{ all: 'Toutes', ...Object.fromEntries(programs.map((p) => [p.id, p.name])) }}
          value={program}
          onChange={setProgram}
        />
      )}

      {!sessions || !totals ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <Kpi value={`${totals.attended}/${totals.sessions}`} label="séances" />
            <Kpi value={`${totals.done}/${totals.blocks}`} label="blocs faits" />
            <Kpi value={String(totals.skipped)} label="passés" />
            <Kpi value={totals.records ? `+${totals.records}` : '0'} label="records" accent={totals.records > 0} />
          </div>
          {totals.blocks > 0 && (
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-lime-400" style={{ width: `${(100 * totals.done) / totals.blocks}%` }} />
            </div>
          )}

          {sessions.length === 0 && <p className="text-sm text-zinc-400">Aucune séance publiée sur la période.</p>}
          {sessions.map(({ workout, status, rows }) => (
            <section key={workout.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate font-semibold">
                  <span className="capitalize">{formatDay(workout.date)}</span> · {workout.title}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${STATUS[status].className}`}
                >
                  {STATUS[status].label}
                </span>
              </div>
              {programs.length > 1 && program === 'all' && <p className="-mt-1 mb-1.5 text-xs text-zinc-500">{workout.program}</p>}
              <ul className="divide-y divide-zinc-800 overflow-hidden rounded-2xl bg-zinc-900">
                {rows.map((row) => (
                  <Row key={row.block.id} row={row} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}

function Kpi({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-zinc-900 px-1 py-2">
      <p className={`text-lg font-bold tabular-nums ${accent ? 'text-amber-400' : ''}`}>{value}</p>
      <p className="text-[11px] text-zinc-500">{label}</p>
    </div>
  )
}

function Row({ row }: { row: ReportRow }) {
  const muted = row.status !== 'done'
  return (
    <li className="px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`min-w-0 truncate font-medium ${muted ? 'text-zinc-500' : ''}`}>{row.block.label}</span>
        <span className={`shrink-0 tabular-nums ${muted ? 'text-sm text-zinc-500' : 'font-semibold'}`}>
          {row.status === 'done' ? (row.block.type === 'none' ? 'Fait ✓' : row.score) : row.status === 'skipped' ? 'Passé' : '—'}
        </span>
      </div>
      {(row.status === 'done' || row.record) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
          {row.rx && row.block.type !== 'none' && row.block.ranked !== false && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300 uppercase">RX</span>
          )}
          {row.block.team && row.status === 'done' && <span>Équipe</span>}
          {row.rank && (
            <span>
              {row.rank.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank.rank - 1] + ' ' : ''}
              {row.rank.rank}
              <sup>{row.rank.rank === 1 ? 'er' : 'e'}</sup> / {row.rank.of}
            </span>
          )}
          {row.record && <span className="font-semibold text-amber-400">🏆 record</span>}
        </div>
      )}
      {row.comment && <p className="mt-1 border-l-2 border-zinc-700 pl-2 text-sm whitespace-pre-line text-zinc-300 italic">{row.comment}</p>}
    </li>
  )
}
