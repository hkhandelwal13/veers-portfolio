/**
 * The finale's scrub — 0 as the sequence pins, 1 as it releases.
 *
 * The section is several viewports tall with a sticky stage inside it, so
 * "scrolling through the finale" is really the outer section travelling past
 * while the stage holds still. That travel is the timeline, and every part of
 * the sequence is a pure function of it: nothing runs on a clock, so scrolling
 * back up plays it exactly backwards, which is the whole point of a scrub.
 *
 * The story it tells, in order:
 *
 *   1. the arrow arrives from below with the section, small and flat-on
 *   2. it grows, in the attitude it arrived in — no turning yet
 *   3. at reading size the headlines come up over it
 *   4. only then does it turn: one revolution while it swells past every edge,
 *      breaking up into the warp as it goes
 *   5. the warp holds; rings arrive one per step of scroll; the manifesto sits
 *      inside them
 *   6. all of it in reverse, one revolution, back to the size and the attitude
 *      it started in — but over the closing screen, not the work grid
 *
 * Derived rather than stored, like the hero's: the ScrollBus and the rect
 * sampler have both already written this frame, so any two callers agree by
 * construction.
 */

import { getTargetRect } from './rect-sampler'
import { getScrollSnapshot } from './scroll-bus'

/** The tall section — the rect the whole thing is scrubbed against. */
export const FINALE_TARGET_ID = 'finale-stage'
/** The sticky stage inside it — the rect the arrow is seated on. */
export const FINALE_ARROW_ID = 'finale-arrow'

/**
 * The beats.
 *
 * Named for what the arrow is doing, because every other signal here is
 * derived from its size: the rays, the fade and the rings all answer to how
 * far past you it has grown, not to the raw scroll.
 */
export const FINALE = {
  /** Arrived and pinned. Rest size, rest attitude. */
  settle: 0.05,
  /** Grown to reading size, still flat-on. The headlines are up. */
  swell: 0.22,
  /** One revolution done; past every edge; the tunnel has taken over. */
  flip: 0.4,
  /**
   * End of the hold.
   *
   * Deliberately most of the section. The hold is the part that has to feel
   * endless — rays travelling out of the centre, rings arriving one after
   * another — and endlessness is a thing you can only spend scroll on. Getting
   * in and back out again takes the other 58%.
   */
  peak: 0.82,
} as const

/** Rest → reading size → past every edge. Multipliers on the seated height. */
const READING_SIZE = 3.6
const PEAK_SIZE = 210

/**
 * Where reading size falls on the log scale between rest and the peak.
 *
 * The growth is geometric (see getArrowScale), so the swell beat has to hand
 * over at the right *share of the exponent*, not at 3.6/210 of the range.
 */
const READING_SHARE = Math.log(READING_SIZE) / Math.log(PEAK_SIZE)

/**
 * How far down the tunnel one pass through the finale carries you.
 *
 * A distance, not a threshold: the rays' depth is fract() of it, so this is
 * really "how many times the whole field recycles", and it is what makes the
 * segments travel out of the centre on the way down and back into it on the
 * way up.
 */
const TUNNEL_LENGTH = 26

/** Rings emitted across the hold. One arrives per unit; six are alive at once. */
const RING_RATE = 62

function clamp01(v: number) {
  return v <= 0 ? 0 : v >= 1 ? 1 : v
}

function smooth(v: number) {
  const t = clamp01(v)
  return t * t * (3 - 2 * t)
}

/** Position within [from, to], clamped. */
function span(t: number, from: number, to: number) {
  return clamp01((t - from) / (to - from))
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
 * How far the arrow has grown, as a share of the exponent — 0 at rest, 1 at
 * the peak.
 *
 * One signal, and the single source for everything the growth drives. Written
 * as a share of the exponent rather than of the scale because the growth is
 * geometric: under perspective an object approaching at a steady speed doubles
 * in apparent size at a steady rate, so it is the exponent that moves evenly
 * and the exponent that the other effects should key off.
 *
 * The return leg runs it straight back down through reading size to rest,
 * which is what makes the exit the entrance in reverse without a second set of
 * numbers to keep in step.
 */
export function getGrowth(t: number): number {
  if (t <= FINALE.settle) return 0
  if (t < FINALE.swell) {
    return smooth(span(t, FINALE.settle, FINALE.swell)) * READING_SHARE
  }
  if (t < FINALE.flip) {
    return READING_SHARE + smooth(span(t, FINALE.swell, FINALE.flip)) * (1 - READING_SHARE)
  }
  if (t <= FINALE.peak) return 1
  return smooth(1 - span(t, FINALE.peak, 1))
}

/** The arrow's scale multiplier over its seated size. */
export function getArrowScale(t: number): number {
  return Math.pow(PEAK_SIZE, getGrowth(t))
}

/**
 * The arrow's spin, in radians — one revolution in, one out, and nothing in
 * between.
 *
 * Deliberately *not* welded to the growth. The arrow arrives and grows in the
 * attitude it arrived in, so the turn is its own beat rather than something
 * that has been happening quietly since the section pinned; and because both
 * revolutions are whole, the flat face is squared up to the camera at rest, at
 * reading size where the headlines come up, and again once it has collapsed
 * back over the closing screen.
 */
export function getArrowSpin(t: number): number {
  const tau = Math.PI * 2
  if (t <= FINALE.swell) return 0
  if (t < FINALE.flip) return smooth(span(t, FINALE.swell, FINALE.flip)) * tau
  if (t <= FINALE.peak) return tau
  return tau + smooth(span(t, FINALE.peak, 1)) * tau
}

/**
 * How far the arrow has become the tunnel, 0..1.
 *
 * Keyed to the growth, so it happens at a size rather than at a moment: the
 * arrow starts giving way to the field once it is around twice the height of
 * the frame, which is the point where its silhouette has left every edge and
 * there is nothing to lose by it. Shrinking back down, the field withdraws into
 * it at exactly the same size.
 */
export function getPortalMix(t: number): number {
  return smooth(clamp01((getGrowth(t) - 0.32) / 0.42))
}

/**
 * Ray density, 0..1 — how many rays exist and how far they reach.
 *
 * Starts a little before the break-up so the rays are already showing when the
 * arrow begins to give way, which is what makes the field read as something
 * that was always behind it rather than as a layer switched on afterwards.
 */
export function getRayDensity(t: number): number {
  return smooth(clamp01((getGrowth(t) - 0.3) / 0.45))
}

/**
 * How far down the tunnel the scroll has carried you.
 *
 * Linear in the raw progress, not in the growth: the rays have to keep moving
 * for as long as the finger does, including across the hold where the arrow's
 * size is pinned and nothing else is changing. This is the only thing answering
 * scroll through most of the section, and it is what the endlessness is made
 * of.
 */
export function getWarpTravel(t: number): number {
  return t * TUNNEL_LENGTH
}

/**
 * How many rings have been emitted, as a real number.
 *
 * The whole number is the count; the fraction is how far the newest has
 * travelled. Linear, because the rings are the hold's other answer to scroll —
 * an eased cadence would stall in the middle of the beat, which is exactly
 * where there is nothing else to look at. They fade out with the portal on the
 * way back rather than being rewound, so the collapse does not play the ball
 * backwards.
 */
export function getRingPhase(t: number): number {
  return span(t, FINALE.flip, FINALE.peak) * RING_RATE
}

/** Which of the three headlines is up, or -1 for none. */
export function getHeadlineStep(t: number): number {
  const start = 0.13
  const end = 0.4
  if (t < start || t >= end) return -1
  return Math.min(2, Math.floor(((t - start) / (end - start)) * 3))
}

/**
 * True once the tunnel is what is behind the copy.
 *
 * The finale's type is white, which is right over the tunnel and wrong over
 * paper — and in the light theme the first headline comes up while the arrow is
 * still a small bright object on a white page. This is the switch: before it,
 * the copy is ink; after it, the arrow has grown past every edge and its
 * interior is the ground.
 */
export function isTunnelBehind(t: number): boolean {
  return getPortalMix(t) > 0.35
}

/** True across the hold, where the manifesto lines sit around the tunnel. */
export function isManifestoUp(t: number): boolean {
  return t >= 0.44 && t < 0.84
}
