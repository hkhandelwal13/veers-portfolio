/**
 * Ring-constrained rim light.
 *
 * Takes the pointer's *direction* from the centre and discards its distance, so
 * the highlight travels around a circle of fixed radius. Following the pointer
 * position directly means that as it nears the middle of the screen the light
 * lands on the front face of the glass and floods it, washing out the letter
 * shapes; keeping only the angle makes the highlight ride the rim, which is the
 * behaviour worth having.
 *
 * Pure math, no three — so the wrap handling below can be reasoned about (and
 * tested) on its own.
 */

/** Where the light rests when the pointer is away: upper right. */
const DEFAULT_ANGLE = Math.atan2(0.9, 0.4)
/** How fast the angle chases the pointer. */
const LAMBDA = 6
/** Below this the pointer is effectively centred and has no meaningful angle. */
const MIN_RADIUS_SQ = 1e-6

/**
 * Interpolates angles the short way round.
 *
 * Angles are not ordinary numbers: crossing from just under +pi to just over
 * -pi is a hair's movement, but a linear blend between those two values sweeps
 * the whole way back through zero. Wrapping the difference into [-pi, pi] first
 * is what stops the light taking that detour.
 */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + difference * (1 - Math.exp(-lambda * dt))
}

export function createRingLight(radius = 1) {
  let angle = DEFAULT_ANGLE

  return {
    /**
     * @param cx pointer x, centre-origin, -1..1
     * @param cy pointer y, centre-origin, -1..1 (screen-down positive)
     * @param inside whether the pointer is still in the window
     */
    update(cx: number, cy: number, inside: boolean, dt: number) {
      // Screen Y grows downward; world Y grows up.
      const y = -cy
      const target = inside && cx * cx + y * y > MIN_RADIUS_SQ ? Math.atan2(y, cx) : DEFAULT_ANGLE

      angle = dampAngle(angle, target, LAMBDA, Math.min(Math.max(dt, 0), 0.1))

      return {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        angle,
      }
    },
    reset() {
      angle = DEFAULT_ANGLE
    },
  }
}
