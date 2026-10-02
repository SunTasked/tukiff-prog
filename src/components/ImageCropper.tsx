import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { clampCrop, drawRect, fitZoom, MAX_ZOOM, scaleOf, type Crop } from '../domain/crop'
import { Button } from './ui'

type Props = { file: File; onCancel: () => void; onSave: (picture: Blob) => void }

/** Profile picture: the circle shows exactly what the avatar will display; the saved picture is its bounding square (JPEG). */
export const AvatarCropper = (props: Props) => (
  <ImageCropper {...props} title="Recadrer la photo" width={256} height={256} type="image/jpeg" round />
)

/** Sponsor logo: 3:1 frame on the background it is shown on; may shrink inside the frame (PNG, margins stay transparent). */
export const LogoCropper = ({ dark, ...props }: Props & { dark: boolean }) => (
  <ImageCropper
    {...props}
    title="Recadrer le logo"
    width={480}
    height={160}
    type="image/png"
    fit
    frameClassName={dark ? 'bg-zinc-800' : 'bg-zinc-100'}
  />
)

/** Full-screen cropper: drag to move, pinch (or slider / mouse wheel) to zoom. */
function ImageCropper({
  file,
  onCancel,
  onSave,
  title,
  width,
  height,
  type,
  round = false,
  fit = false,
  frameClassName = 'bg-zinc-900',
}: Props & {
  title: string
  /** Output size in px; the frame has the same proportions. */
  width: number
  height: number
  type: 'image/jpeg' | 'image/png'
  /** Circle overlay (avatar). */
  round?: boolean
  /** The picture may be zoomed out until it fits whole inside the frame. */
  fit?: boolean
  frameClassName?: string
}) {
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
  const vh = (view * height) / width
  const minZoom = fit && img && view ? fitZoom(w, h, view, vh) : 1
  // Functional updates: several pointer moves can land before a re-render.
  const update = (next: (c: Crop) => Crop) => setCrop((c) => clampCrop(w, h, view, vh, next(c), minZoom))

  // A logo starts whole inside the frame.
  const started = useRef(false)
  useEffect(() => {
    if (!fit || !img || !view || started.current) return
    started.current = true
    setCrop({ zoom: minZoom, x: 0, y: 0 })
  }, [fit, img, view, minZoom])

  // Keep the crop valid when the viewport size changes (rotation).
  useEffect(() => {
    if (img && view) setCrop((c) => clampCrop(img.naturalWidth, img.naturalHeight, view, vh, c, minZoom))
  }, [img, view, vh, minZoom])

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
      const z = Math.min(MAX_ZOOM, Math.max(minZoom, zoom(c.zoom)))
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
    const { dx, dy, dw, dh } = drawRect(w, h, view, vh, crop)
    const k = width / view
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, dx * k, dy * k, dw * k, dh * k)
    canvas.toBlob((b) => (b ? onSave(b) : setFailed(true)), type, 0.85)
  }

  const s = scaleOf(w, h, view, vh, crop.zoom)

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 p-4">
      <h2 className="font-semibold">{title}</h2>
      <div
        ref={box}
        className={`relative w-full max-w-sm cursor-grab touch-none overflow-hidden rounded-2xl select-none active:cursor-grabbing ${frameClassName}`}
        style={{ aspectRatio: `${width} / ${height}` }}
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
        {round && <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] ring-2 ring-lime-400" />}
      </div>
      {failed ? (
        <p className="text-sm text-red-400">Image illisible : essaie une autre image (JPEG ou PNG).</p>
      ) : (
        <p className="text-sm text-zinc-400">Déplace l’image et pince pour zoomer.</p>
      )}
      <input
        type="range"
        aria-label="Zoom"
        min={minZoom}
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
