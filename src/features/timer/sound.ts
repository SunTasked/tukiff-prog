// Beeps with Web Audio. The context must be created from a user gesture (iOS).
import type { Cue } from '../../domain/timer'

let ctx: AudioContext | null = null

export function unlockAudio() {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
}

export function play(c: Cue) {
  if (!c || !ctx) return
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
