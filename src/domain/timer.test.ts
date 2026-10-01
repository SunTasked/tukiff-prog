import { describe, expect, it } from 'vitest'
import { cue, timerFromBlock, timerFromParams, timerState, timerToParams, totalDuration, type TimerConfig } from './timer'

const s = (c: TimerConfig, sec: number) => timerState(c, sec * 1000)

it('starts with a 10 s countdown', () => {
  const c: TimerConfig = { mode: 'amrap', duration_s: 600 }
  expect(s(c, 0)).toMatchObject({ phase: 'countdown', display_s: 10 })
  expect(s(c, 9.2)).toMatchObject({ phase: 'countdown', display_s: 1 })
  expect(s(c, 10)).toMatchObject({ phase: 'work', display_s: 600 })
})

describe('modes', () => {
  it('For Time counts up and stops at the cap', () => {
    const c: TimerConfig = { mode: 'for_time', cap_s: 300 }
    expect(s(c, 10 + 65.7)).toMatchObject({ phase: 'work', display_s: 65, counting: 'up' })
    expect(s(c, 10 + 300)).toMatchObject({ phase: 'done', display_s: 300 })
    expect(s({ mode: 'for_time', cap_s: null }, 10 + 5000)).toMatchObject({ phase: 'work', display_s: 5000, progress: null })
  })
  it('AMRAP counts down', () => {
    const c: TimerConfig = { mode: 'amrap', duration_s: 720 }
    expect(s(c, 10 + 0.5)).toMatchObject({ display_s: 720 })
    expect(s(c, 10 + 719.5)).toMatchObject({ display_s: 1 })
    expect(s(c, 10 + 720)).toMatchObject({ phase: 'done', display_s: 0 })
  })
  it('EMOM tracks rounds and time left in the minute', () => {
    const c: TimerConfig = { mode: 'emom', interval_s: 60, rounds: 10 }
    expect(s(c, 10 + 0)).toMatchObject({ round: 1, display_s: 60 })
    expect(s(c, 10 + 125)).toMatchObject({ round: 3, display_s: 55 })
    expect(s(c, 10 + 600)).toMatchObject({ phase: 'done', round: 10 })
  })
  it('Tabata alternates work and rest, no rest after the last round', () => {
    const c: TimerConfig = { mode: 'tabata', work_s: 20, rest_s: 10, rounds: 8 }
    expect(totalDuration(c)).toBe(230)
    expect(s(c, 10 + 5)).toMatchObject({ phase: 'work', round: 1, display_s: 15 })
    expect(s(c, 10 + 25)).toMatchObject({ phase: 'rest', round: 1, display_s: 5 })
    expect(s(c, 10 + 30)).toMatchObject({ phase: 'work', round: 2, display_s: 20 })
    expect(s(c, 10 + 229)).toMatchObject({ phase: 'work', round: 8, display_s: 1 })
    expect(s(c, 10 + 230)).toMatchObject({ phase: 'done' })
  })
})

describe('cues', () => {
  const c: TimerConfig = { mode: 'tabata', work_s: 20, rest_s: 10, rounds: 2 }
  it('beeps at phase changes, on the last 3 seconds and at the end', () => {
    expect(cue(s(c, 9.9), s(c, 10))).toBe('start')
    expect(cue(s(c, 10 + 16.5), s(c, 10 + 17.1))).toBe('tick') // 3 left
    expect(cue(s(c, 10 + 19.9), s(c, 10 + 20))).toBe('start') // rest
    expect(cue(s(c, 10 + 5), s(c, 10 + 5.5))).toBeNull()
    expect(cue(s(c, 10 + 49.9), s(c, 10 + 50))).toBe('end')
  })
  it('ticks during the countdown', () => {
    expect(cue(s(c, 6.5), s(c, 7.1))).toBe('tick')
  })
})

it('builds a timer from a block and round-trips through the URL', () => {
  const c = timerFromBlock('emom', { interval_s: 90, rounds: 8 })!
  expect(c).toEqual({ mode: 'emom', interval_s: 90, rounds: 8 })
  expect(timerFromParams(new URLSearchParams(timerToParams(c)))).toEqual(c)
  expect(timerFromBlock('sets_reps', {})).toBeNull()
  expect(timerFromParams(new URLSearchParams({ mode: 'for_time' }))).toEqual({ mode: 'for_time', cap_s: null })
})

describe('For Time in stages', () => {
  // 16.2: 4 min, extended by 4 min per cleared stage, cap 20 min.
  const c: TimerConfig = { mode: 'for_time', cap_s: 1200, stage_s: 240 }
  it('shows the current stage and the time left in it, none in the last one', () => {
    expect(s(c, 10 + 30)).toMatchObject({ stage: 1, stage_left_s: 210, display_s: 30 })
    expect(s(c, 10 + 250)).toMatchObject({ stage: 2, stage_left_s: 230 })
    expect(s(c, 10 + 1000)).toMatchObject({ stage: null, stage_left_s: null })
    expect(s({ mode: 'for_time', cap_s: 720, stage_s: 360, stage_step_s: 180 }, 10 + 400)).toMatchObject({ stage: 2, stage_left_s: 140 })
  })
  it('beeps 3-2-1 then long at the end of each stage', () => {
    expect(cue(s(c, 10 + 236.5), s(c, 10 + 237.1))).toBe('tick')
    expect(cue(s(c, 10 + 239.9), s(c, 10 + 240))).toBe('end')
    expect(cue(s(c, 10 + 959.9), s(c, 10 + 960))).toBe('end') // last stage before the cap
    expect(cue(s(c, 10 + 300), s(c, 10 + 300.5))).toBeNull()
  })
  it('keeps its stages from the block and through the URL', () => {
    const t = timerFromBlock('for_time', { time_cap_s: 1440, stage_s: 480, stage_step_s: 240 })!
    expect(t).toEqual({ mode: 'for_time', cap_s: 1440, stage_s: 480, stage_step_s: 240 })
    expect(timerFromParams(new URLSearchParams(timerToParams(t)))).toEqual(t)
  })
})
