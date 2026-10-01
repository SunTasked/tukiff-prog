import { describe, expect, it } from 'vitest'
import { clampCrop, cropRect } from './crop'

describe('crop', () => {
  it('centers the shortest side at zoom 1', () => {
    expect(cropRect(400, 200, 100, { zoom: 1, x: 0, y: 0 })).toEqual({ sx: 100, sy: 0, side: 200 })
  })

  it('keeps the picture covering the viewport', () => {
    expect(clampCrop(400, 200, 100, { zoom: 1, x: 500, y: 30 })).toEqual({ zoom: 1, x: 50, y: 0 })
    expect(clampCrop(400, 200, 100, { zoom: 0.5, x: 0, y: 0 }).zoom).toBe(1)
    expect(clampCrop(400, 200, 100, { zoom: 9, x: 0, y: 0 }).zoom).toBe(4)
  })

  it('maps a pan to the matching source square', () => {
    // Dragged fully right: the left edge of the picture is shown.
    expect(cropRect(400, 200, 100, { zoom: 1, x: 50, y: 0 })).toEqual({ sx: 0, sy: 0, side: 200 })
    // Zoom 2, centered: a 100 px square in the middle.
    expect(cropRect(400, 200, 100, { zoom: 2, x: 0, y: 0 })).toEqual({ sx: 150, sy: 50, side: 100 })
  })
})
