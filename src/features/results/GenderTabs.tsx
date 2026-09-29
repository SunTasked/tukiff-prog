import { GENDERS, type Gender } from '../../domain/profile'

const TITLES: Record<Gender, string> = { male: 'Hommes', female: 'Femmes' }

/** Men / women tabs of the full leaderboards, with the number of athletes of each. */
export function GenderTabs({ value, counts, onChange }: { value: Gender; counts: Record<Gender, number>; onChange: (g: Gender) => void }) {
  return (
    <div className="mb-3 flex gap-1 rounded-xl bg-zinc-900 p-1">
      {(Object.keys(GENDERS) as Gender[]).map((g) => (
        <button
          key={g}
          className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${g === value ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400'}`}
          onClick={() => onChange(g)}
        >
          {TITLES[g]} ({counts[g]})
        </button>
      ))}
    </div>
  )
}
