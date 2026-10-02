import { useState } from 'react'
import { LeaderBadge } from './LeaderBadge'
import { usePalmares } from './palmares'

/** "Palmarès (?)": weeks as leader and blocks won, the rules in a tooltip on (?). */
export function PalmaresTiles({ athleteId }: { athleteId: string | undefined }) {
  const p = usePalmares().get(athleteId ?? '')
  const [help, setHelp] = useState(false)
  return (
    <div className="relative">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
        Palmarès
        <button
          className={`grid size-5 place-items-center rounded-full border text-xs ${help ? 'border-lime-400 text-lime-400' : 'border-zinc-600 text-zinc-400'}`}
          aria-label="Comment est calculé le palmarès"
          onClick={() => setHelp(!help)}
        >
          ?
        </button>
      </p>
      {help && (
        <p
          className="absolute top-6 right-0 left-0 z-10 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-xs text-zinc-300 shadow-lg shadow-black"
          onClick={() => setHelp(false)}
        >
          LEADER : semaines terminées à la 1re place d'un classement de la semaine (1 au plus par semaine, classements d'au
          moins 3 athlètes). 🥇 : blocs gagnés en RX (ex æquo compris, au moins 3 athlètes classés, hors équipe et
          challenge). Mis à jour chaque lundi à 00:00. Couronne sur la photo la semaine qui suit 3 blocs gagnés.
        </p>
      )}
      <div className="mt-1 flex gap-2">
        <span className="flex flex-1 items-center gap-2 rounded-xl bg-zinc-950 px-3 py-2 ring-1 ring-zinc-800">
          <LeaderBadge />
          <span className="text-lg leading-none font-bold whitespace-nowrap">× {p?.leader_weeks ?? 0}</span>
        </span>
        <span className="flex flex-1 items-center gap-2 rounded-xl bg-zinc-950 px-3 py-2 ring-1 ring-zinc-800">
          <span className="leading-none">🥇</span>
          <span className="text-lg leading-none font-bold whitespace-nowrap">× {p?.wins ?? 0}</span>
        </span>
      </div>
    </div>
  )
}
