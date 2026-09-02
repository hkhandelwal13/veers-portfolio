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
  settle: 0.06,
  /** Grown to reading size, still flat-on. The headlines are up. */
  swell: 0.34,
  /** One revolution done; past every edge; the warp has taken over. */
  flip: 0.62,
  /** End of the hold — full warp, rings, manifesto. */
  peak: 0.72,
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

/** How many rings the tunnel emits across the hold. */
const RING_COUNT = 7

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
 * The dot-matrix break-up, 0..1 — the arrow going from object to window.
 *
 * Keyed to the growth, so it happens at a size rather than at a moment: the
 * arrow starts letting go once it is around twice the height of the frame,
 * which is the point where its silhouette has left every edge and there is
 * nothing to lose by it.
 */
export function getArrowDissolve(t: number): number {
  return smooth(clamp01((getGrowth(t) - 0.45) / 0.42))
}

/**
 * How dark the room is, 0..1.
 *
 * The warp is a dark room you go into, not a graphic laid over the page. In
 * the dark theme the ground is already black and this changes nothing; in the
 * light theme it is what stops the sequence being white lines on white paper,
 * and it is what the white copy is legible against in both.
 *
 * Keyed to the very start of the growth, so it is fully up before the first
 * headline and lifts again only once the arrow is nearly back to rest — the
 * whole thing is a slow full-screen fade with only the arrow on it, which is
 * the one moment in the section where a change of ground has nothing to catch
 * on.
 */
export function getRoomDarkness(t: number): number {
  return smooth(clamp01(getGrowth(t) / 0.1))
}

/**
 * Ray density, 0..1 — how many rays exist and how far they reach.
 *
 * Starts a little before the break-up so the rays are already showing when the
 * arrow begins to give way, which is what makes the field read as something
 * that was always behind it rather than as a layer switched on afterwards.
 */
export function getRayDensity(t: number): number {
  return smooth(clamp01((getGrowth(t) - 0.34) / 0.5))
}

/**
 * How many rings the tunnel has emitted, as a real number.
 *
 * The whole number is the count; the fraction is how far the newest one has
 * travelled. Linear rather than eased, because the rings are the hold's answer
 * to scroll — an eased cadence would stall in the middle of the beat where
 * there is nothing else moving.
 */
export function getRingPhase(t: number): number {
  if (t < FINALE.flip) return 0
  if (t <= FINALE.peak) return span(t, FINALE.flip, FINALE.peak) * RING_COUNT
  // Swallowed back as the collapse begins, rather than left hanging over it.
  return (1 - span(t, FINALE.peak, FINALE.peak + 0.1)) * RING_COUNT
}

/** Which of the three headlines is up, or -1 for none. */
export function getHeadlineStep(t: number): number {
  const start = 0.2
  const end = 0.56
  if (t < start || t >= end) return -1
  return Math.min(2, Math.floor(((t - start) / (end - start)) * 3))
}

/** True across the hold, where the manifesto lines sit around the tunnel. */
export function isManifestoUp(t: number): boolean {
  return t >= 0.63 && t < 0.8
}
