import { useEffect, useRef, type RefObject } from 'react'
import { swipeDirection } from '../domain/swipe'

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

/** Calls `onSwipe` on a horizontal finger swipe inside `ref` (vertical scrolling is left alone). */
export function useSwipe(ref: RefObject<HTMLElement | null>, onSwipe: (dir: 'left' | 'right') => void) {
  const latest = useRef(onSwipe)
  useEffect(() => {
    latest.current = onSwipe
  })
  useEffect(() => {
    const root = ref.current
    if (!root) return
    let start: { x: number; y: number } | null = null
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      start = e.touches.length === 1 && !ownedElsewhere(e.target, root) ? { x: t.clientX, y: t.clientY } : null
    }
    const onEnd = (e: TouchEvent) => {
      if (!start) return
      const t = e.changedTouches[0]
      const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y)
      start = null
      if (dir) latest.current(dir)
    }
    const onCancel = () => (start = null)
    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchend', onEnd, { passive: true })
    root.addEventListener('touchcancel', onCancel)
    return () => {
      root.removeEventListener('touchstart', onStart)
      root.removeEventListener('touchend', onEnd)
      root.removeEventListener('touchcancel', onCancel)
    }
  }, [ref])
}
