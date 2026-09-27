import type { Assignment, Profile, Program } from '../../lib/supabase'

export const isEveryone = (a: Assignment) => a.program_id === null && a.athlete_id === null

export function targetsLabel(assignments: Assignment[], programs: Program[], members: Profile[]): string {
  if (assignments.length === 0) return 'Aucune cible'
  return assignments
    .map((a) =>
      isEveryone(a)
        ? 'Tous'
        : a.program_id
          ? (programs.find((p) => p.id === a.program_id)?.name ?? 'Programme archivé')
          : (members.find((m) => m.id === a.athlete_id)?.display_name ?? 'Ancien membre'),
    )
    .join(', ')
}
