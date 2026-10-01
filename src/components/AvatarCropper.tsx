import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { clampCrop, cropRect, MAX_ZOOM, scaleOf, type Crop } from '../domain/crop'
import { Button } from './ui'

const OUTPUT = 256

/**
 * Full-screen cropper: drag to move, pinch (or slider / mouse wheel) to zoom.
 * The circle shows exactly what the avatar will display; the saved picture is its bounding square.
 */
export function AvatarCropper({ file, onCancel, onSave }: { file: File; onCancel: () => void; onSave: (picture: Blob) => void }) {
  const [src, setSrc] = useState<string | null>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [failed, setFailed] = useState(false)
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 })
  const [view, setView] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => setView(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const w = img?.naturalWidth ?? 1
  const h = img?.naturalHeight ?? 1
  // Functional updates: several pointer moves can land before a re-render.
  const update = (next: (c: Crop) => Crop) => setCrop((c) => clampCrop(w, h, view, next(c)))

  // Keep the crop valid when the viewport size changes (rotation).
  useEffect(() => {
    if (img && view) setCrop((c) => clampCrop(img.naturalWidth, img.naturalHeight, view, c))
  }, [img, view])

  function down(e: PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  function move(e: PointerEvent) {
    const map = pointers.current
    const prev = map.get(e.pointerId)
    if (!prev) return
    const others = [...map.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p)
    map.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (others.length === 0) {
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      update((c) => ({ ...c, x: c.x + dx, y: c.y + dy }))
    } else {
      // Pinch: zoom by the change in distance to the other finger, around the viewport center.
      const o = others[0]
      const before = Math.hypot(prev.x - o.x, prev.y - o.y)
      const after = Math.hypot(e.clientX - o.x, e.clientY - o.y)
      if (before > 0) zoomBy(after / before)
    }
  }

  function up(e: PointerEvent) {
    pointers.current.delete(e.pointerId)
  }

  function zoomTo(zoom: (current: number) => number) {
    update((c) => {
      const z = Math.min(MAX_ZOOM, Math.max(1, zoom(c.zoom)))
      // Scale the offset too so the point under the center stays put.
      return { zoom: z, x: (c.x * z) / c.zoom, y: (c.y * z) / c.zoom }
    })
  }
  const zoomBy = (factor: number) => zoomTo((z) => z * factor)

  function wheel(e: WheelEvent) {
    zoomBy(Math.exp(-e.deltaY / 500))
  }

  function save() {
    if (!img || !view) return
    const { sx, sy, side } = cropRect(w, h, view, crop)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT, OUTPUT)
    canvas.toBlob((b) => (b ? onSave(b) : setFailed(true)), 'image/jpeg', 0.85)
  }

  const s = scaleOf(w, h, view, crop.zoom)

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 p-4">
      <h2 className="font-semibold">Recadrer la photo</h2>
      <div
        ref={box}
        className="relative aspect-square w-full max-w-sm cursor-grab touch-none overflow-hidden rounded-2xl bg-zinc-900 select-none active:cursor-grabbing"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={wheel}
      >
        {src && (
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => setImg(e.currentTarget)}
            onError={() => setFailed(true)}
            className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
            style={
              img && view
                ? { width: w * s, height: h * s, transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px))` }
                : { visibility: 'hidden' }
            }
          />
        )}
        {/* Darkened outside + outlined circle = what the avatar shows. */}
        <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] ring-2 ring-lime-400" />
      </div>
      {failed ? (
        <p className="text-sm text-red-400">Image illisible : essaie une autre photo (JPEG ou PNG).</p>
      ) : (
        <p className="text-sm text-zinc-400">Déplace la photo et pince pour zoomer.</p>
      )}
      <input
        type="range"
        aria-label="Zoom"
        min={1}
        max={MAX_ZOOM}
        step={0.01}
        value={crop.zoom}
        onChange={(e) => {
          const z = Number(e.target.value)
          zoomTo(() => z)
        }}
        className="w-full max-w-sm accent-lime-400"
      />
      <div className="flex w-full max-w-sm gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="button" className="flex-1" disabled={!img || failed} onClick={save}>
          Valider
        </Button>
      </div>
    </div>
  )
}
