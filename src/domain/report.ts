// Coach report on one athlete: what was programmed, what they scored, skipped or left empty.
import type { Gender } from './profile'
import { formatScore, rankResults, type Score, type ScoreType } from './scoring'

export type ReportBlock = { id: string; label: string; type: ScoreType; ranked?: boolean; team?: boolean; exerciseIds: string[] }
export type ReportWorkout = { id: string; date: string; title: string; program: string; blocks: ReportBlock[] }
export type ReportResult = Score & {
  block_id: string
  athlete_id: string
  rx: boolean
  comment: string | null
  gender: Gender | null
}
export type ReportRecord = { exercise_id: string | null; benchmark_name: string | null; date: string }

export type RowStatus = 'done' | 'skipped' | 'empty'
export type ReportRow = {
  block: ReportBlock
  status: RowStatus
  score?: string
  /** false: scaled score, never ranked. */
  rx?: boolean
  /** Rank among the RX of the same gender, with the size of that board (RX scores of ranked blocks only). */
  rank?: { rank: number; of: number }
  comment?: string
  record: boolean
}
export type SessionStatus = 'done' | 'partial' | 'skipped' | 'missed'
export type ReportSession = { workout: ReportWorkout; status: SessionStatus; rows: ReportRow[] }

export function sessionStatus(rows: { status: RowStatus }[]): SessionStatus {
  const done = rows.filter((r) => r.status === 'done').length
  if (rows.length > 0 && done === rows.length) return 'done'
  if (done > 0) return 'partial'
  return rows.some((r) => r.status === 'skipped') ? 'skipped' : 'missed'
}

/** Sessions newest first. results: everyone's results on these workouts (for ranks). */
export function buildReport(
  athleteId: string,
  workouts: ReportWorkout[],
  results: ReportResult[],
  skipped: Set<string>,
  records: ReportRecord[],
): ReportSession[] {
  return [...workouts]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((workout) => {
      const rows = workout.blocks.map((block): ReportRow => {
        const record = records.some(
          (r) =>
            r.date === workout.date &&
            ((r.exercise_id && block.exerciseIds.includes(r.exercise_id)) ||
              (r.benchmark_name && block.label.toLowerCase().includes(r.benchmark_name.toLowerCase()))),
        )
        const mine = results.find((r) => r.block_id === block.id && r.athlete_id === athleteId)
        if (!mine) return { block, status: skipped.has(block.id) ? 'skipped' : 'empty', record }
        let rank: ReportRow['rank']
        // Team scores are ranked among teams, shown on the block only.
        if (block.type !== 'none' && block.ranked !== false && !block.team && mine.rx) {
          const board = results.filter(
            (r) => r.block_id === block.id && r.rx && (r.gender ?? 'male') === (mine.gender ?? 'male'),
          )
          const ranked = rankResults(block.type, board)
          rank = { rank: ranked.find((x) => x.result === mine)!.rank, of: board.length }
        }
        return {
          block,
          status: 'done',
          score: formatScore(block.type, mine),
          rx: mine.rx,
          rank,
          comment: mine.comment ?? undefined,
          record,
        }
      })
      return { workout, status: sessionStatus(rows), rows }
    })
}

export function reportTotals(sessions: ReportSession[], records: ReportRecord[]) {
  const rows = sessions.flatMap((s) => s.rows)
  return {
    sessions: sessions.length,
    attended: sessions.filter((s) => s.status === 'done' || s.status === 'partial').length,
    blocks: rows.length,
    done: rows.filter((r) => r.status === 'done').length,
    skipped: rows.filter((r) => r.status === 'skipped').length,
    records: records.length,
  }
}
