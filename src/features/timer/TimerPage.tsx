import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { DurationPicker, NumberInput } from '../../components/inputs'
import { Button, Chips, Field } from '../../components/ui'
import {
  TIMER_MODES,
  cue,
  defaultTimer,
  timerFromParams,
  timerState,
  type TimerConfig,
  type TimerMode,
  type TimerState,
} from '../../domain/timer'
import { formatDuration } from '../../domain/workout'
import { play, unlockAudio } from './sound'
import { keepAwake } from './wakeLock'

/** Setup (prefilled from the URL when opened from a block), then the running timer. */
export function TimerPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [config, setConfig] = useState<TimerConfig>(() => timerFromParams(params) ?? defaultTimer('amrap'))
  const [running, setRunning] = useState(false)
  const title = params.get('title')

  if (running) return <RunningTimer config={config} title={title} onExit={() => setRunning(false)} />

  const int = (v: number | null) => Math.max(1, Math.round(v ?? 1))
  const c = config
  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="self-start text-sm text-zinc-400">
        ‹ Retour
      </button>
      <h1 className="text-2xl font-bold">Timer{title ? ` · ${title}` : ''}</h1>
      <Chips options={TIMER_MODES} value={c.mode} onChange={(m: TimerMode) => setConfig(defaultTimer(m))} />

      {c.mode === 'for_time' && (
        <Field label="Time cap (optionnel)">
          <DurationPicker size="lg" value={c.cap_s} onChange={(v) => setConfig({ ...c, cap_s: v })} />
        </Field>
      )}
      {c.mode === 'amrap' && (
        <Field label="Durée">
          <DurationPicker size="lg" value={c.duration_s} onChange={(v) => setConfig({ ...c, duration_s: v ?? 60 })} />
        </Field>
      )}
      {c.mode === 'emom' && (
        <>
          <Field label="Toutes les">
            <DurationPicker size="lg" value={c.interval_s} onChange={(v) => setConfig({ ...c, interval_s: v || 60 })} />
          </Field>
          <Field label="Rounds">
            <NumberInput value={c.rounds} onChange={(v) => setConfig({ ...c, rounds: int(v) })} />
          </Field>
        </>
      )}
      {c.mode === 'tabata' && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Travail (s)">
            <NumberInput value={c.work_s} onChange={(v) => setConfig({ ...c, work_s: int(v) })} />
          </Field>
          <Field label="Repos (s)">
            <NumberInput value={c.rest_s} onChange={(v) => setConfig({ ...c, rest_s: int(v) })} />
          </Field>
          <Field label="Rounds">
            <NumberInput value={c.rounds} onChange={(v) => setConfig({ ...c, rounds: int(v) })} />
          </Field>
        </div>
      )}

      <Button
        className="mt-2 py-4 text-lg"
        onClick={() => {
          unlockAudio() // must happen in the tap handler on iOS
          setRunning(true)
        }}
      >
        ▶ Démarrer
      </Button>
      <p className="text-xs text-zinc-500">
        10 s de décompte avant le départ. Sur iPhone, les bips ne sortent pas si le mode silencieux est activé.
      </p>
    </div>
  )
}

const PHASE_LABEL: Record<TimerState['phase'], string> = {
  countdown: 'Prêt ?',
  work: 'Go',
  rest: 'Repos',
  done: 'Terminé',
}

function RunningTimer({ config, title, onExit }: { config: TimerConfig; title: string | null; onExit: () => void }) {
  // Elapsed time = accumulated (before pauses) + time since the last start.
  const [accumulated, setAccumulated] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const prev = useRef<TimerState | null>(null)

  const elapsed = accumulated + (startedAt ? now - startedAt : 0)
  const state = timerState(config, elapsed)
  const paused = startedAt === null

  useEffect(() => {
    keepAwake(true)
    return () => keepAwake(false)
  }, [])

  useEffect(() => {
    if (paused || state.phase === 'done') return
    let raf = 0
    const loop = () => {
      setNow(Date.now())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [paused, state.phase])

  useEffect(() => {
    play(cue(prev.current, state))
    prev.current = state
  })

  function pause() {
    setAccumulated(elapsed)
    setStartedAt(null)
  }
  function resume() {
    unlockAudio()
    setNow(Date.now())
    setStartedAt(Date.now())
  }

  const color =
    state.phase === 'rest' ? 'text-sky-400' : state.phase === 'countdown' ? 'text-amber-400' : state.phase === 'done' ? 'text-zinc-300' : 'text-lime-400'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] select-none">
      <div className="flex items-center justify-between text-zinc-400">
        <span className="font-semibold">
          {TIMER_MODES[config.mode]}
          {title ? ` · ${title}` : ''}
        </span>
        <button className="px-2 py-1" onClick={onExit}>
          Fermer
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className={`text-3xl font-bold tracking-widest uppercase ${color}`}>{PHASE_LABEL[state.phase]}</p>
        <p className={`font-mono text-[28vw] leading-none font-bold tabular-nums ${color}`}>
          {state.phase === 'countdown' ? state.display_s : formatDuration(state.display_s)}
        </p>
        {state.round !== null && (
          <p className="text-2xl text-zinc-300">
            Round <b>{state.round}</b> / {state.rounds}
          </p>
        )}
        {state.progress !== null && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-lime-400" style={{ width: `${state.progress * 100}%` }} />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {state.phase !== 'done' &&
          (paused ? (
            <Button className="flex-1 py-4 text-lg" onClick={resume}>
              Reprendre
            </Button>
          ) : (
            <Button variant="secondary" className="flex-1 py-4 text-lg" onClick={pause}>
              Pause
            </Button>
          ))}
        {config.mode === 'for_time' && state.phase === 'work' && !paused && (
          <Button className="flex-1 py-4 text-lg" onClick={pause}>
            Fini !
          </Button>
        )}
        {(paused || state.phase === 'done') && (
          <Button variant="secondary" className="flex-1 py-4 text-lg" onClick={onExit}>
            Réinitialiser
          </Button>
        )}
      </div>
    </div>
  )
}
