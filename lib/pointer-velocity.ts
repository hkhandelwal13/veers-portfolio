/**
 * Pointer velocity, in WebGL UV space — the one input the fluid simulation has.
 *
 * Derived from the PointerBus rather than from listeners of its own. That bus
 * already owns the site's single pointermove listener and already handles the
 * cases this needs handling for — leaving the window, the window blurring, the
 * tab going hidden — and a second listener would be a second source of truth
 * for the same three events.
 *
 * Two things are converted here that the bus does not do:
 *
 *   - Y is flipped. Browser coordinates grow downward from the top-left; UV
 *     grows upward from the bottom-left. Getting this wrong sends every splat
 *     the wrong way vertically, which reads as the fluid fighting the pointer.
 *   - velocity is measured against the RAW pointer, not the eased one. The
 *     bus's easing exists so parallax lags; measuring a delta against a lagged
 *     position measures the easing rather than the hand.
 *
 * Plain {x, y} objects rather than THREE.Vector2 on purpose: this module is
 * advanced by the frame loop, which runs whether or not a canvas ever mounts,
 * and importing three here would pull the whole library into the bundle that
 * has to work when WebGL is unavailable. The properties that matter — reused
 * objects, no per-frame allocation — hold either way.
 */

import { pointer, pointerRaw } from './pointer-bus'

export type Vec2 = { x: number; y: number }

export type PointerState = {
  /** Where the pointer is now, in UV with the origin bottom-left. */
  current: Vec2
  /** Where it was on the previous frame. */
  previous: Vec2
  /** UV per second, this frame. */
  velocity: Vec2
  /** The same, exponentially damped — what the splat actually uses. */
  smoothedVelocity: Vec2
  inside: boolean
}

export const pointerVelocity: PointerState = {
  current: { x: 0.5, y: 0.5 },
  previous: { x: 0.5, y: 0.5 },
  velocity: { x: 0, y: 0 },
  smoothedVelocity: { x: 0, y: 0 },
  inside: false,
}

const MIN_DT = 1 / 240
const MAX_DT = 0.05

/**
 * UV per second past which a movement is treated as a jump rather than a swipe.
 *
 * A tab that has been in the background for a minute reports one enormous frame
 * on its way back, and a pointer that crosses the window while the page is
 * hidden arrives somewhere else entirely. Both are teleports, and a teleport
 * scaled by 1/dt is a splat that saturates the whole simulation.
 */
const MAX_SPEED = 6

let seeded = false
let smoothing = 14
let idleDecay = 0.9

/** Set once from the resolved config, so the loop needs no arguments. */
export function configurePointerVelocity(velocitySmoothing: number, decay: number) {
  smoothing = velocitySmoothing
  idleDecay = decay
}

/** Called once per frame by the frame loop, straight after the PointerBus. */
export function updatePointerVelocity(deltaSeconds: number) {
  const dt = Math.min(Math.max(deltaSeconds, MIN_DT), MAX_DT)
  const state = pointerVelocity
  const inside = pointer.inside

  state.current.x = pointerRaw.x
  state.current.y = 1 - pointerRaw.y

  // Adopt the position without a delta on the first frame, and on any frame
  // where the pointer was not inside a moment ago. Re-entering the window is a
  // jump from wherever it left, and the bus parks the target at the centre
  // while it is away — measuring across either is a swipe that never happened.
  if (!seeded || !inside || !state.inside) {
    state.previous.x = state.current.x
    state.previous.y = state.current.y
    seeded = true
  }

  let vx = (state.current.x - state.previous.x) / dt
  let vy = (state.current.y - state.previous.y) / dt

  const speed = Math.sqrt(vx * vx + vy * vy)
  if (speed > MAX_SPEED) {
    const scale = MAX_SPEED / speed
    vx *= scale
    vy *= scale
  }

  state.velocity.x = vx
  state.velocity.y = vy
  state.previous.x = state.current.x
  state.previous.y = state.current.y

  // Frame-rate independent: the same curve at 30fps and 144fps.
  const alpha = 1 - Math.exp(-smoothing * dt)
  state.smoothedVelocity.x += (vx - state.smoothedVelocity.x) * alpha
  state.smoothedVelocity.y += (vy - state.smoothedVelocity.y) * alpha

  if (!inside) {
    state.smoothedVelocity.x *= idleDecay
    state.smoothedVelocity.y *= idleDecay
  }

  state.inside = inside
}

/** Test seam, and the reset a remount wants. */
export function resetPointerVelocity() {
  seeded = false
  pointerVelocity.velocity.x = 0
  pointerVelocity.velocity.y = 0
  pointerVelocity.smoothedVelocity.x = 0
  pointerVelocity.smoothedVelocity.y = 0
  pointerVelocity.inside = false
}
