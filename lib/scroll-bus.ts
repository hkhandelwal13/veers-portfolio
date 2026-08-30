/**
 * ScrollBus — the single scroll snapshot for the frame.
 *
 * Lenis is ticked once per frame by the frame loop (lib/frame-loop.ts), and the
 * bus immediately records what it read. WebGL then consumes that same snapshot
 * inside useFrame, later in the very same frame, so the 3D layer can never be
 * reading last frame's scroll position while the DOM has already moved — the
 * one-frame slip you otherwise see at speed.
 *
 * React reads it through useSyncExternalStore, but only where scroll actually
 * changes DOM output. The snapshot object is replaced only when a value really
 * changes, so an idle page notifies nobody and re-renders nothing.
 */

export type ScrollSnapshot = Readonly<{
  /** Smoothed scroll offset in px. */
  scrollTop: number
  /** Maximum scrollable offset in px. */
  limit: number
  /** 0..1 through the document. */
  progress: number
  /** Lenis velocity — signed, px per tick. */
  velocity: number
  /** 1 down, -1 up, 0 at rest. */
  direction: number
  viewportHeight: number
  /** px moved since the previous frame. The rect cache shifts by this. */
  delta: number
  /** Monotonic frame counter, used to stagger distant re-measures. */
  frame: number
}>

const INITIAL: ScrollSnapshot = Object.freeze({
  scrollTop: 0,
  limit: 0,
  progress: 0,
  velocity: 0,
  direction: 0,
  viewportHeight: 0,
  delta: 0,
  frame: 0,
})

let current: ScrollSnapshot = INITIAL
const listeners = new Set<() => void>()

/** Minimal shape the bus needs — keeps it decoupled from the Lenis class. */
type ScrollSource = {
  scroll: number
  limit: number
  progress: number
  velocity: number
  direction: number
  dimensions: { height: number }
}

/**
 * Called once per frame by the frame loop, straight after lenis.raf().
 * Returns the snapshot so the caller can hand it on without a second read.
 */
export function updateScrollBus(source: ScrollSource | null): ScrollSnapshot {
  const frame = current.frame + 1

  if (!source) {
    // No Lenis yet (or it was torn down): keep the last values, advance the
    // frame counter so staggered work still progresses.
    current = Object.freeze({ ...current, delta: 0, frame })
    return current
  }

  const scrollTop = source.scroll
  const delta = scrollTop - current.scrollTop
  const progress = Number.isFinite(source.progress) ? source.progress : 0

  const unchanged =
    scrollTop === current.scrollTop &&
    source.limit === current.limit &&
    source.velocity === current.velocity &&
    source.direction === current.direction &&
    source.dimensions.height === current.viewportHeight

  // Idle: hold the existing reference so React subscribers stay quiet. The
  // frame counter still needs to advance, but nothing observing the bus in
  // React cares about it, so it is not worth a notification.
  if (unchanged && current.delta === 0) {
    current = Object.freeze({ ...current, frame })
    return current
  }

  current = Object.freeze({
    scrollTop,
    limit: source.limit,
    progress,
    velocity: source.velocity,
    direction: source.direction,
    viewportHeight: source.dimensions.height,
    delta,
    frame,
  })

  for (const listener of listeners) listener()
  return current
}

/** Mutable read for per-frame WebGL code — no allocation, no subscription. */
export function getScrollSnapshot(): ScrollSnapshot {
  return current
}

export function subscribeToScroll(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getServerScrollSnapshot(): ScrollSnapshot {
  return INITIAL
}

/** Test seam — resets module state between suites. */
export function resetScrollBus() {
  current = INITIAL
  listeners.clear()
}
