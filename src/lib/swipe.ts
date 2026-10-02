import { useEffect, useRef, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { swipeAxis, swipeCommits } from '../domain/swipe'

/** Gap (px) between two pages while dragging. */
const GAP = 16
const DURATION_MS = 250

/**
 * True when a touch starting on `target` belongs to something else than the page:
 * a form field, a horizontally scrollable area (tables, chips), or a fixed overlay (sheets, modals).
 */
function ownedElsewhere(target: EventTarget | null, root: Element) {
  for (let el = target instanceof Element ? target : null; el && el !== root; el = el.parentElement) {
    if (el.matches('input, textarea, select, [contenteditable], [data-no-swipe]')) return true
    const style = getComputedStyle(el)
    if (style.position === 'fixed') return true
    if (el.scrollWidth > el.clientWidth && /auto|scroll/.test(style.overflowX)) return true
  }
  return false
}

/**
 * Carousel-like paging: a horizontal drag anywhere in `area` moves `track` with the finger. The track holds the
 * current page in the flow, and the previous/next pages absolutely positioned on each side of it (see `pageOffset`),
 * shifted down by `--swipe-shift` so their top shows where the viewport is. Released far or fast enough, the track
 * slides to the neighbour and `onCommit` switches pages; otherwise it springs back. Vertical scrolling is left alone.
 */
export function usePageSwipe(
  area: RefObject<HTMLElement | null>,
  track: RefObject<HTMLElement | null>,
  onCommit: (dir: 'prev' | 'next') => void,
) {
  const latest = useRef(onCommit)
  useEffect(() => {
    latest.current = onCommit
  })
  useEffect(() => {
    const root = area.current
    if (!root) return
    let g: { x: number; y: number; axis: 'x' | 'y' | null; samples: { x: number; t: number }[]; shift: number } | null = null
    let animating = false

    const move = (dx: number, animate: boolean) => {
      const el = track.current!
      el.style.transition = animate ? `transform ${DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)` : 'none'
      el.style.transform = dx ? `translateX(${dx}px)` : ''
    }

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      g =
        !animating && e.touches.length === 1 && track.current && !ownedElsewhere(e.target, root)
          ? { x: t.clientX, y: t.clientY, axis: null, samples: [{ x: t.clientX, t: e.timeStamp }], shift: 0 }
          : null
    }
    const onMove = (e: TouchEvent) => {
      if (!g || e.touches.length !== 1) return
      const t = e.touches[0]
      const dx = t.clientX - g.x
      if (!g.axis) {
        g.axis = swipeAxis(dx, t.clientY - g.y)
        if (g.axis === 'x') {
          // Neighbours start at the track top: bring their top to the viewport if the page is scrolled down.
          g.shift = Math.max(0, -track.current!.getBoundingClientRect().top)
          track.current!.style.setProperty('--swipe-shift', `${g.shift}px`)
        }
      }
      if (g.axis !== 'x') return
      e.preventDefault() // no vertical scroll while paging
      g.samples = [...g.samples.filter((s) => e.timeStamp - s.t < 100), { x: t.clientX, t: e.timeStamp }]
      move(dx, false)
    }
    const onEnd = (e: TouchEvent) => {
      if (!g || g.axis !== 'x') return (g = null)
      const gesture = g
      g = null
      const x = e.changedTouches[0].clientX
      const first = gesture.samples[0]
      const velocity = (x - first.x) / Math.max(1, e.timeStamp - first.t)
      const dx = x - gesture.x
      const el = track.current!
      const width = el.offsetWidth
      animating = true
      if (!swipeCommits(dx, velocity, width)) {
        move(0, true)
        setTimeout(() => (animating = false), DURATION_MS)
        return
      }
      move(Math.sign(dx) * (width + GAP), true)
      setTimeout(() => {
        // Switch pages and put the track back in the same frame: the neighbour, now the current page, doesn't move.
        flushSync(() => latest.current(dx < 0 ? 'next' : 'prev'))
        move(0, false)
        el.style.removeProperty('--swipe-shift')
        if (gesture.shift) window.scrollBy(0, el.getBoundingClientRect().top)
        animating = false
      }, DURATION_MS)
    }
    const onCancel = () => {
      if (g?.axis === 'x') move(0, true)
      g = null
    }
    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchmove', onMove, { passive: false })
    root.addEventListener('touchend', onEnd, { passive: true })
    root.addEventListener('touchcancel', onCancel)
    return () => {
      root.removeEventListener('touchstart', onStart)
      root.removeEventListener('touchmove', onMove)
      root.removeEventListener('touchend', onEnd)
      root.removeEventListener('touchcancel', onCancel)
    }
  }, [area, track])
}

/** Style placing a neighbour page beside the current one (-1 = previous, 1 = next) inside the swipe track. */
export const pageOffset = (side: -1 | 1) => ({
  position: 'absolute' as const,
  insetInline: 0,
  top: 'var(--swipe-shift, 0px)',
  transform: `translateX(calc(${side * 100}% + ${side * GAP}px))`,
})
