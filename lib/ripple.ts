/**
 * The pointer's wake — the input to the hero's fluid distortion.
 *
 * A ring of recent pointer positions, each with an age. Shaders sum a decaying
 * ring wave around every one of them, which is what turns a single moving
 * pointer into a trail that keeps spreading after it has passed rather than a
 * blob stuck under the cursor.
 *
 * Flat Float32Arrays because they are uploaded straight to `vec2 uRippleCenter[N]`
 * and `float uRippleAge[N]` — three writes those with uniform2fv/uniform1fv, so
 * no per-frame array of objects has to be built or garbage collected.
 *
 * Fed from the PointerBus, like everything else that reacts to the pointer; it
 * attaches no listener of its own.
 */

import { pointerRaw } from './pointer-bus'

/** Must match the array size declared in the shaders. */
export const RIPPLE_COUNT = 8

/** Seconds a ripple keeps expanding before it is spent. */
export const RIPPLE_LIFE = 1.6

/** How far the pointer must travel, in UV, before it drops another. */
const DROP_DISTANCE = 0.035

export const rippleCenters = new Float32Array(RIPPLE_COUNT * 2)
/** Ages start spent, so nothing rings before the pointer has ever moved. */
export const rippleAges = new Float32Array(RIPPLE_COUNT).fill(RIPPLE_LIFE * 2)

let next = 0
let lastX = pointerRaw.x
let lastY = pointerRaw.y

export function updateRipples(deltaSeconds: number) {
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.1)
  for (let i = 0; i < RIPPLE_COUNT; i++) rippleAges[i] += dt

  const dx = pointerRaw.x - lastX
  const dy = pointerRaw.y - lastY
  if (Math.hypot(dx, dy) < DROP_DISTANCE) return

  lastX = pointerRaw.x
  lastY = pointerRaw.y
  rippleCenters[next * 2] = pointerRaw.x
  rippleCenters[next * 2 + 1] = pointerRaw.y
  rippleAges[next] = 0
  next = (next + 1) % RIPPLE_COUNT
}

/** Test seam, and a way to settle the field when the hero leaves. */
export function clearRipples() {
  rippleAges.fill(RIPPLE_LIFE * 2)
}
