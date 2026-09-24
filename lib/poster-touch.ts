/** Distinguishes a deliberate poster tap from a scrolling finger. */
export function createPosterTouchIntent() {
  let start: { x: number; y: number; scroll: number } | null = null
  let moved = false
  let armed = false
  return {
    start(x: number, y: number, scroll: number) {
      start = { x, y, scroll }
      moved = false
    },
    move(x: number, y: number) {
      if (start && Math.hypot(x - start.x, y - start.y) > 10) {
        moved = true
        armed = false
      }
      return moved
    },
    cancel() { moved = true; armed = false },
    reset() { armed = false; start = null; moved = false },
    tap(scroll: number): 'ignore' | 'preview' | 'open' {
      const deliberate = start && !moved && Math.abs(scroll - start.scroll) <= 8
      start = null
      if (!deliberate) { armed = false; return 'ignore' }
      if (armed) { armed = false; return 'open' }
      armed = true
      return 'preview'
    },
  }
}
