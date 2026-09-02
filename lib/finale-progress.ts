/**
 * The finale's scrub — 0 as the sequence pins, 1 as it releases.
 *
 * The section is several viewports tall with a sticky stage inside it, so
 * "scrolling through the finale" is really the outer section travelling past
 * while the stage holds still. That travel is the timeline, and every part of
 * the sequence is a pure function of it: nothing runs on a clock, so scrolling
 * back up plays it exactly backwards, which is the whole point of a scrub.
 *
 * Derived rather than stored, like the hero's: the ScrollBus and the rect
 * sampler have both already written this frame, so any two callers agree by
 * construction.
 */

import { getTargetRect } from './rect-sampler'
import { getScrollSnapshot } from './scroll-bus'

export const FINALE_TARGET_ID = 'finale-stage'

/** The beats. Shared by the shader, the arrow and the copy. */
export const FINALE = {
  /** Idle: the arrow small, flat-on, at rest. */
  approach: 0.1,
  /** Zooming in; rays begin to show through it. */
  open: 0.4,
  /** Past the frame edges — the warp is the screen. */
  peak: 0.6,
  /** Collapsing back in. */
  close: 0.76,
} as const

function clamp01(v: number) {
  return v <= 0 ? 0 : v >= 1 ? 1 : v
}

function smooth(v: number) {
  const t = clamp01(v)
  return t * t * (3 - 2 * t)
}

export function getFinaleProgress(): number {
  const rect = getTargetRect(FINALE_TARGET_ID)
  const { viewportHeight } = getScrollSnapshot()
  if (!rect || !rect.valid || viewportHeight <= 0) return 0

  // The stage is pinned for exactly (height - viewport) of scroll.
  const travel = rect.height - viewportHeight
  if (travel <= 0) return 0

  return clamp01(-rect.y / travel)
}

/** True while any of the sequence is on screen — the passes that cost read this. */
export function isFinaleVisible(): boolean {
  const rect = getTargetRect(FINALE_TARGET_ID)
  const { viewportHeight } = getScrollSnapshot()
  if (!rect || !rect.valid || viewportHeight <= 0) return false
  return rect.y < viewportHeight && rect.y + rect.height > 0
}

/**
 * How far open the portal is, 0..1.
 *
 * Rises through the zoom, holds across the peak, falls through the collapse, so
 * the rays arrive with the arrow's growth and leave with its retreat instead of
 * switching on at a threshold.
 */
export function getPortalOpen(t: number): number {
  if (t <= FINALE.approach) return 0
  if (t < FINALE.open) {
    return smooth((t - FINALE.approach) / (FINALE.open - FINALE.approach))
  }
  if (t <= FINALE.close) return 1
  return smooth(1 - (t - FINALE.close) / (1 - FINALE.close))
}

/**
 * How much of the arrow is still an object, 0..1.
 *
 * Falls away early in the zoom and returns late in the collapse, because the
 * silhouette is off the frame edges for most of both — see the note in the
 * fragment shader. Tied to the zoom rather than to the portal so it is
 * symmetric on the way out by construction.
 */
export function getSolidity(t: number): number {
  return 1 - smooth(clamp01(getPortalOpen(t) / SOLID_SPAN))
}

/** How far into the portal's opening the plate has entirely given way. */
const SOLID_SPAN = 0.45

/** How much bigger the arrow gets at the peak than at rest. */
const PEAK_ZOOM = 191

/**
 * The arrow's scale multiplier: small, enormous, small again.
 *
 * Overshoots well past the point where it covers the viewport, so there is a
 * stretch of scroll where the geometry is off every edge and only its interior
 * is visible. That stretch is the "inside it" part of the sequence — without
 * the overshoot the silhouette never leaves the frame and it reads as a big
 * arrow rather than as somewhere you have gone.
 */
export function getPortalZoom(t: number): number {
  const open = getPortalOpen(t)
  // Geometric, not quadratic. Under perspective, something coming at you at a
  // steady speed doubles in apparent size at a steady rate — so a scale that
  // multiplies evenly reads as an even approach, where `open * open` sits still
  // for most of the zoom and then arrives all at once.
  //
  // The ceiling is far past covering the viewport: the arrow is a wedge, not a
  // disc, so a scale that merely reaches the frame edges still leaves its
  // corners showing — and a black corner at the peak is the shape reasserting
  // itself exactly where you are meant to have forgotten it.
  return Math.pow(PEAK_ZOOM, open)
}

/**
 * The arrow's spin, in radians — one full turn in, one full turn out.
 *
 * Both revolutions are whole, and both land on a multiple of 2π, so the arrow
 * is presenting the same flat face to the camera at rest, at the moment the
 * zoom hands over to the warp, and again once it has collapsed back. What turns
 * in between is the depth of the thing: it goes edge-on halfway through each
 * revolution, which is what makes it read as an object you are travelling past
 * rather than a shape being spun in the plane of the screen.
 *
 * Eased at both ends of each turn, so the rotation arrives with the growth and
 * leaves with the retreat instead of snapping into motion.
 */
export function getArrowSpin(t: number): number {
  const tau = Math.PI * 2

  // Driven off the same span the plate dissolves over, so the turn is welded to
  // the growth: the arrow is exactly one revolution further round at the moment
  // it stops being an arrow, and exactly one more by the time it is back. Doing
  // it on raw `t` instead spends half the first turn during the idle beat,
  // where nothing is growing yet, and the two read as separate events.
  const phase = smooth(clamp01(getPortalOpen(t) / SOLID_SPAN))

  // Past the peak the phase runs back down; the spin has to keep going forward,
  // so the return leg counts up from where the first turn finished. Both legs
  // give exactly one turn at the peak, so the seam is continuous.
  return (t < FINALE.peak ? phase : 2 - phase) * tau
}

/**
 * Ray density, 0..1 — how many rays exist and how far they reach.
 *
 * One continuous climb to a single point and one continuous fall away from it,
 * rather than a rise into a plateau. The field has to keep visibly filling for
 * as long as you keep scrolling in, and keep visibly emptying for as long as
 * you scroll back out; a hold in the middle is a stretch of scroll where
 * nothing answers, which reads as the effect having finished early.
 */
export function getRayDensity(t: number): number {
  const centre = 0.68
  if (t <= centre) {
    return clamp01(smooth((t - FINALE.approach) / (centre - FINALE.approach)))
  }
  return clamp01(1 - smooth((t - centre) / (1 - centre)))
}

/** The rings only exist at the peak, where the manifesto sits. */
export function getRingStrength(t: number): number {
  const inp = smooth((t - FINALE.peak) / (0.68 - FINALE.peak))
  const out = 1 - smooth((t - 0.72) / (FINALE.close - 0.72))
  return clamp01(inp) * clamp01(out)
}

/** Which of the three warp headlines is up, or -1 for none. */
export function getHeadlineStep(t: number): number {
  if (t < FINALE.approach || t >= FINALE.peak) return -1
  const span = (FINALE.peak - FINALE.approach) / 3
  return Math.min(2, Math.floor((t - FINALE.approach) / span))
}

/** True across the peak, where the manifesto lines sit around the burst. */
export function isManifestoUp(t: number): boolean {
  return t >= FINALE.peak && t < 0.75
}
