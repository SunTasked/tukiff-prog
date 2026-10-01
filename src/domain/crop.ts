/** Square crop of a picture shown in a square viewport: the picture always covers the viewport. */
export type Crop = { zoom: number; x: number; y: number }

export const MAX_ZOOM = 4

/** Display scale (screen px per picture px) for a zoom level; zoom 1 = shortest side fills the viewport. */
export const scaleOf = (w: number, h: number, view: number, zoom: number) => (view / Math.min(w, h)) * zoom

/** Keeps the zoom in range and the offset (from the centered position) inside the picture. */
export function clampCrop(w: number, h: number, view: number, crop: Crop): Crop {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, crop.zoom))
  const s = scaleOf(w, h, view, zoom)
  const mx = (w * s - view) / 2
  const my = (h * s - view) / 2
  return { zoom, x: Math.min(mx, Math.max(-mx, crop.x)), y: Math.min(my, Math.max(-my, crop.y)) }
}

/** Source square (picture px) under the viewport. */
export function cropRect(w: number, h: number, view: number, crop: Crop) {
  const s = scaleOf(w, h, view, crop.zoom)
  return { sx: (w * s - view) / 2 / s - crop.x / s, sy: (h * s - view) / 2 / s - crop.y / s, side: view / s }
}
