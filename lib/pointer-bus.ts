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

/**
 * Where the pointer actually is, unsmoothed; `pointer` chases this.
 *
 * Exported because the cursor needs both readings at once: a lens that lags is
 * the whole effect, but the dot you actually click with has to sit exactly
 * under the physical pointer.
 */
export const pointerRaw = { x: 0.5, y: 0.5 }

/**
 * Physical input for the GPU fluid simulation. Touch writes here without
 * affecting the hover/parallax target, so dragging the page can make a fluid
 * wake without tilting the glass models.
 */
export const fluidPointer = { x: 0.5, y: 0.5, active: false }

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

function readUv(clientX: number, clientY: number) {
  const { innerWidth, innerHeight } = window
  if (innerWidth === 0 || innerHeight === 0) return null
  return {
    x: Math.min(1, Math.max(0, clientX / innerWidth)),
    y: Math.min(1, Math.max(0, clientY / innerHeight)),
  }
}

function setRaw(clientX: number, clientY: number) {
  const uv = readUv(clientX, clientY)
  if (!uv) return null
  pointerRaw.x = uv.x
  pointerRaw.y = uv.y
  fluidPointer.x = uv.x
  fluidPointer.y = uv.y
  fluidPointer.active = true
  return uv
}

function setTargetFromEvent(event: PointerEvent) {
  const uv = setRaw(event.clientX, event.clientY)
  if (!uv) return

  // A scrolling finger is not a hover pointer. It still feeds the fluid, but
  // model tilt remains neutral.
  if (event.pointerType === 'touch') {
    settleToCenter()
    return
  }

  target.x = uv.x
  target.y = uv.y
  targetInside = true
}

function setTargetFromTouch(event: TouchEvent) {
  const touch = event.touches[0]
  if (!touch) return
  setRaw(touch.clientX, touch.clientY)
  settleToCenter()
}

function settleToCenter() {
  target.x = CENTER.x
  target.y = CENTER.y
  targetInside = false
}

function deactivateFluid() {
  fluidPointer.active = false
}

let attached = false

/** Attaches the listeners. Returns a teardown; safe to call more than once. */
export function attachPointerBus() {
  if (attached || typeof window === 'undefined') return () => {}
  attached = true

  const onMove = (event: PointerEvent) => setTargetFromEvent(event)
  const onLeave = () => {
    settleToCenter()
    deactivateFluid()
  }
  const onBlur = () => {
    settleToCenter()
    deactivateFluid()
  }
  const onVisibility = () => {
    if (document.hidden) {
      settleToCenter()
      deactivateFluid()
    }
  }
  const onTouch = (event: TouchEvent) => setTargetFromTouch(event)
  const onTouchEnd = () => deactivateFluid()

  // The bus only observes input. Touch listeners stay passive so they never
  // compete with Lenis/native scrolling.
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('touchstart', onTouch, { passive: true })
  window.addEventListener('touchmove', onTouch, { passive: true })
  window.addEventListener('touchend', onTouchEnd, { passive: true })
  window.addEventListener('touchcancel', onTouchEnd, { passive: true })
  document.addEventListener('pointerleave', onLeave)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('touchstart', onTouch)
    window.removeEventListener('touchmove', onTouch)
    window.removeEventListener('touchend', onTouchEnd)
    window.removeEventListener('touchcancel', onTouchEnd)
    document.removeEventListener('pointerleave', onLeave)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onVisibility)
    deactivateFluid()
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
