import { useState } from 'react'
import { groupRounds, repPlan, roundReps, totalReps } from '../../domain/repcount'
import type { BlockDraft } from '../../domain/workout'

/**
 * Converts what the athlete counts (complete rounds, sub-block rounds of the round in progress, extra reps)
 * into total reps, live. Hidden when a movement cannot be counted in reps.
 */
export function RepCounter({ block, onTotal }: { block: BlockDraft; onTotal: (reps: number) => void }) {
  const plan = repPlan(block)
  const [rounds, setRounds] = useState(0)
  const [sub, setSub] = useState<number[]>(() => block.groups.map(() => 0))
  const [extra, setExtra] = useState(0)
  if (!plan) return null

  function update(r: number, s: number[], e: number) {
    setRounds(r)
    setSub(s)
    setExtra(e)
    onTotal(totalReps(plan!, r, s, e))
  }

  // Sub-blocks done several times in a round get their own counter; the others count as reps.
  const counted = block.groups.map((g, i) => ({ g, i })).filter(({ g }) => (g.start ?? 1) > 1 || (g.step ?? 0) > 0)
  const marks = [1, 2, 3, 4, 5, 6].map((r) => ({ r, total: totalReps(plan, r, [], 0) }))

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 p-3">
      <p className="text-sm font-semibold">Calculer mes reps</p>
      <Stepper
        label="Tours complets"
        hint={`tour = tout le bloc, ex. tour 1 = ${roundReps(plan, 1)} reps`}
        value={rounds}
        onChange={(v) => update(v, sub, extra)}
      />
      {counted.map(({ g, i }) => (
        <Stepper
          key={i}
          label={`${g.title || 'Sous-bloc'} dans le tour entamé`}
          hint={`${plan.groupReps[i]} reps chacun, ${groupRounds(g, rounds + 1)} à faire dans le tour ${rounds + 1}`}
          value={sub[i]}
          onChange={(v) => update(rounds, sub.map((x, j) => (j === i ? v : x)), extra)}
        />
      ))}
      <Stepper label="Reps en plus" value={extra} onChange={(v) => update(rounds, sub, v)} />
      <p className="text-xs text-zinc-500">
        Repères : {marks.map(({ r, total }) => `${r} tour${r > 1 ? 's' : ''} = ${total}`).join(' · ')}
      </p>
    </div>
  )
}

function Stepper({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (v: number) => void }) {
  const btn = 'size-10 shrink-0 rounded-lg bg-zinc-800 text-lg font-semibold text-zinc-100 active:bg-zinc-700'
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>
      <button type="button" className={btn} aria-label={`${label} moins 1`} onClick={() => onChange(Math.max(0, value - 1))}>
        −
      </button>
      <input
        inputMode="numeric"
        aria-label={label}
        className="w-12 rounded-lg border border-zinc-800 bg-zinc-950 py-2 text-center tabular-nums outline-none focus:border-lime-400"
        value={value}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
      />
      <button type="button" className={btn} aria-label={`${label} plus 1`} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  )
}
