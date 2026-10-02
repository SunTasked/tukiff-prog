/** Crop of a picture shown in a vw × vh viewport. Offsets are in screen px from the centered position. */
export type Crop = { zoom: number; x: number; y: number }

export const MAX_ZOOM = 4

/** Display scale (screen px per picture px); zoom 1 = the picture just covers the viewport. */
export const scaleOf = (w: number, h: number, vw: number, vh: number, zoom: number) => Math.max(vw / w, vh / h) * zoom

/** Smallest zoom where the whole picture fits in the viewport (logos: margins stay transparent). */
export const fitZoom = (w: number, h: number, vw: number, vh: number) => Math.min(vw / w, vh / h) / Math.max(vw / w, vh / h)

/**
 * Keeps the zoom in [minZoom, MAX_ZOOM] and the offset in range: a side larger than the viewport
 * keeps covering it, a smaller one stays inside it.
 */
export function clampCrop(w: number, h: number, vw: number, vh: number, crop: Crop, minZoom = 1): Crop {
  const zoom = Math.min(MAX_ZOOM, Math.max(minZoom, crop.zoom))
  const s = scaleOf(w, h, vw, vh, zoom)
  const mx = Math.abs(w * s - vw) / 2
  const my = Math.abs(h * s - vh) / 2
  return { zoom, x: Math.min(mx, Math.max(-mx, crop.x)), y: Math.min(my, Math.max(-my, crop.y)) }
}

/** Where the whole picture lands in the viewport (screen px); scale it to draw the output. */
export function drawRect(w: number, h: number, vw: number, vh: number, crop: Crop) {
  const s = scaleOf(w, h, vw, vh, crop.zoom)
  return { dx: vw / 2 + crop.x - (w * s) / 2, dy: vh / 2 + crop.y - (h * s) / 2, dw: w * s, dh: h * s }
}
