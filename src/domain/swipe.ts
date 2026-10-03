/** Finger travel (px) before a gesture is classified as horizontal or vertical. */
export const SWIPE_LOCK_PX = 10

/** Axis of a gesture once the finger moved enough, null before. Horizontal needs a clearly sideways move. */
export function swipeAxis(dx: number, dy: number): 'x' | 'y' | null {
  if (Math.hypot(dx, dy) < SWIPE_LOCK_PX) return null
  return Math.abs(dx) > 1.2 * Math.abs(dy) ? 'x' : 'y'
}

/**
 * Whether a horizontal drag released after `dx` px at `velocity` px/ms turns the page:
 * dragged past 30% of the width, or flicked fast enough.
 */
export function swipeCommits(dx: number, velocity: number, width: number) {
  return Math.abs(dx) > 0.3 * width || (Math.abs(velocity) > 0.4 && Math.abs(dx) > 30 && Math.sign(velocity) === Math.sign(dx))
}
