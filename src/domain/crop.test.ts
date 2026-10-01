import { describe, expect, it } from 'vitest'
import { clampCrop, drawRect, fitZoom } from './crop'

describe('crop', () => {
  it('centers the picture covering a square viewport at zoom 1', () => {
    expect(drawRect(400, 200, 100, 100, { zoom: 1, x: 0, y: 0 })).toEqual({ dx: -50, dy: 0, dw: 200, dh: 100 })
  })

  it('keeps the picture covering the viewport', () => {
    expect(clampCrop(400, 200, 100, 100, { zoom: 1, x: 500, y: 30 })).toEqual({ zoom: 1, x: 50, y: 0 })
    expect(clampCrop(400, 200, 100, 100, { zoom: 0.5, x: 0, y: 0 }).zoom).toBe(1)
    expect(clampCrop(400, 200, 100, 100, { zoom: 9, x: 0, y: 0 }).zoom).toBe(4)
  })

  it('maps a pan and a zoom', () => {
    // Dragged fully right: the left edge of the picture is at the viewport's left edge.
    expect(drawRect(400, 200, 100, 100, { zoom: 1, x: 50, y: 0 }).dx).toBe(0)
    // Zoom 2, centered: a 100 px square from the middle of the picture fills the viewport.
    expect(drawRect(400, 200, 100, 100, { zoom: 2, x: 0, y: 0 })).toEqual({ dx: -150, dy: -50, dw: 400, dh: 200 })
  })

  it('lets a logo fit inside a wide viewport, staying inside it', () => {
    // Square logo in a 300 × 100 frame: cover = 3×, fit = 1×.
    const min = fitZoom(100, 100, 300, 100)
    expect(min).toBeCloseTo(1 / 3)
    expect(drawRect(100, 100, 300, 100, { zoom: min, x: 0, y: 0 })).toEqual({ dx: 100, dy: 0, dw: 100, dh: 100 })
    expect(clampCrop(100, 100, 300, 100, { zoom: 0.1, x: 500, y: 0 }, min)).toEqual({ zoom: min, x: 100, y: 0 })
  })
})
