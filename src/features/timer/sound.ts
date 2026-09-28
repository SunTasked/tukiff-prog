// Beeps with Web Audio. The context must be created from a user gesture (iOS).
import type { Cue } from '../../domain/timer'

let ctx: AudioContext | null = null

// Safari 16.4+: the "playback" audio session plays even with the silent switch on
// (it pauses music playing on the phone, like any media app).
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } }

export function unlockAudio() {
  const session = (navigator as AudioSessionNavigator).audioSession
  if (session) session.type = 'playback'
  ctx ??= new AudioContext()
  if (ctx.state !== 'running') ctx.resume()
  // iOS only unlocks output once a sound actually starts inside the gesture.
  const silent = ctx.createBufferSource()
  silent.buffer = ctx.createBuffer(1, 1, 22050)
  silent.connect(ctx.destination)
  silent.start()
}

export function play(c: Cue) {
  if (!c || !ctx) return
  // iOS suspends ("interrupted") the context after a lock screen or a call.
  if (ctx.state !== 'running') ctx.resume()
  const [freq, duration] = c === 'tick' ? [660, 0.12] : c === 'start' ? [990, 0.45] : [990, 1.2]
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = freq
  osc.type = 'square'
  gain.gain.setValueAtTime(0.25, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}
