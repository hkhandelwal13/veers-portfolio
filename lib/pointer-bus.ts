/**
 * PointerBus — one pointer reading for the whole app.
 *
 * Browser coords are converted to a single 0–1 UV once, here, rather than in
 * every effect that wants them. Parallax, rim light and the Phase-4 cursor
 * effects all read this; none of them attach their own listener.
 *
 * Two readings are published:
 *   - `pointer`, mutated in place, for per-frame WebGL code (no allocation)
 *   - an immutable snapshot for React, refreshed at most once per frame
 *
 * When the pointer leaves the window, the window blurs, or the tab is hidden,
 * the target returns to centre so effects settle instead of freezing mid-lean.
 */

export type PointerSnapshot = Readonly<{
  /** 0..1 across the viewport, origin top-left. */
  x: number
  /** 0..1 down the viewport, origin top-left. */
  y: number
  /** -1..1, centre-origin — the form most parallax wants. */
  cx: number
  cy: number
  /** False once the pointer has left, blurred or the tab is hidden. */
  inside: boolean
}>

const CENTER = { x: 0.5, y: 0.5 }

/** Eased value the WebGL layer reads. Mutated in place every frame. */
export const pointer = { x: 0.5, y: 0.5, cx: 0, cy: 0, inside: false }

/** Where the pointer actually is; `pointer` chases this. */
const target = { x: 0.5, y: 0.5 }
let targetInside = false

const INITIAL: PointerSnapshot = Object.freeze({
  x: 0.5,
  y: 0.5,
  cx: 0,
  cy: 0,
  inside: false,
})

let snapshot: PointerSnapshot = INITIAL
const listeners = new Set<() => void>()

/** Frame-rate independent easing — same curve at 30fps and 144fps. */
function damp(from: number, to: number, lambda: number, dt: number) {
  return from + (to - from) * (1 - Math.exp(-lambda * dt))
}

function setTargetFromEvent(event: PointerEvent) {
  const { innerWidth, innerHeight } = window
  if (innerWidth === 0 || innerHeight === 0) return
  target.x = event.clientX / innerWidth
  target.y = event.clientY / innerHeight
  targetInside = true
}

function settleToCenter() {
  target.x = CENTER.x
  target.y = CENTER.y
  targetInside = false
}

let attached = false

/** Attaches the listeners. Returns a teardown; safe to call more than once. */
export function attachPointerBus() {
  if (attached || typeof window === 'undefined') return () => {}
  attached = true

  const onMove = (event: PointerEvent) => setTargetFromEvent(event)
  const onLeave = () => settleToCenter()
  const onBlur = () => settleToCenter()
  const onVisibility = () => {
    if (document.hidden) settleToCenter()
  }

  // Passive: the bus only reads, and a non-passive move listener would make
  // scrolling jankier for no reason.
  window.addEventListener('pointermove', onMove, { passive: true })
  // pointerout with no relatedTarget means it actually left the window, not
  // just crossed into a child element.
  document.addEventListener('pointerleave', onLeave)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    window.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerleave', onLeave)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onVisibility)
    attached = false
  }
}

const EPSILON = 0.0005

/**
 * Called once per frame by the frame loop. Eases toward the target and
 * republishes the React snapshot only when something moved enough to matter.
 */
export function commitPointerBus(deltaSeconds: number) {
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.1)

  pointer.x = damp(pointer.x, target.x, 8, dt)
  pointer.y = damp(pointer.y, target.y, 8, dt)
  pointer.cx = pointer.x * 2 - 1
  pointer.cy = pointer.y * 2 - 1
  pointer.inside = targetInside

  const moved =
    Math.abs(pointer.x - snapshot.x) > EPSILON ||
    Math.abs(pointer.y - snapshot.y) > EPSILON ||
    pointer.inside !== snapshot.inside

  if (!moved) return

  snapshot = Object.freeze({
    x: pointer.x,
    y: pointer.y,
    cx: pointer.cx,
    cy: pointer.cy,
    inside: pointer.inside,
  })

  for (const listener of listeners) listener()
}

export function getPointerSnapshot(): PointerSnapshot {
  return snapshot
}

export function subscribeToPointer(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getServerPointerSnapshot(): PointerSnapshot {
  return INITIAL
}
