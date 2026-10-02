/** Minimum horizontal travel (px) for a swipe. */
export const SWIPE_MIN_PX = 60

/**
 * Direction of a finished touch gesture, or null when it isn't a clear horizontal swipe
 * (too short, or mostly vertical: a scroll).
 */
export function swipeDirection(dx: number, dy: number): 'left' | 'right' | null {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 2 * Math.abs(dy)) return null
  return dx < 0 ? 'left' : 'right'
}
