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
  /**
   * Pinned.
   *
   * Zero, not a beat of its own: the arrow has already been growing on the way
   * in (see getEntryScale), so there is nothing left to settle into — pinning
   * is the moment the growth changes hands, not the moment it starts.
   */
  settle: 0,
  /** Grown to reading size, still flat-on. The headlines are up. */
  swell: 0.26,
  /** One revolution done; past every edge; the tunnel has taken over. */
  flip: 0.44,
  /**
   * End of the hold.
   *
   * Still the largest single beat: the hold is the part that has to feel
   * endless, and endlessness is a thing you can only spend scroll on. Two
   * viewports of it rather than three — long enough to stop reading as an
   * effect, short enough not to become a wait.
   */
  peak: 0.78,
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
const TUNNEL_LENGTH = 12

/** Rings emitted across the hold. One arrives per unit; six are alive at once. */
const RING_RATE = 46

/** Slots on the conveyor — mirrors RING_SLOTS in shaders/warp. */
const RING_SLOTS = 6

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
 * How much bigger the arrow gets on the way in, before anything is pinned.
 *
 * The section's own travel is the timeline once it is pinned, but the run-up to
 * that is a whole viewport of scroll in which the arrow used to do nothing but
 * ride into frame at a fixed size. The work grid leaving and the arrow starting
 * to come at you are one movement, not two, so the approach is part of the
 * growth: the arrow is already swelling while the grid is still on screen, and
 * arrives at its seated size exactly as the stage pins.
 */
const ENTRY_GAIN = 2.4

export function getEntryScale(): number {
  const rect = getTargetRect(FINALE_TARGET_ID)
  const { viewportHeight } = getScrollSnapshot()
  if (!rect || !rect.valid || viewportHeight <= 0) return 1

  // 0 with the section's top edge at the fold, 1 once it has reached the top.
  const entry = clamp01(1 - rect.y / viewportHeight)
  return Math.pow(ENTRY_GAIN, smooth(entry) - 1)
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
 * Ray density, 0..1 — how many rays exist at all.
 *
 * Two terms multiplied. The gate is the arrow: no rays until it is big enough
 * to be a window rather than an object. The ramp is the scroll, and it is the
 * one that matters — it climbs the whole way to the peak and falls the whole
 * way back, so the field keeps filling for as long as you keep going down and
 * keeps emptying for as long as you go back up.
 *
 * Deliberately not saturated by the time the tunnel takes over. Reaching full
 * density at the moment the arrow opens leaves the entire hold at one
 * unchanging thickness, which is the point where an endless tunnel starts to
 * read as a still image with motion painted on it.
 */
export function getRayDensity(t: number): number {
  const gate = smooth(clamp01((getGrowth(t) - 0.28) / 0.22))
  const ramp =
    t <= FINALE.peak
      ? span(t, FINALE.swell, FINALE.peak)
      : 1 - span(t, FINALE.peak, 1)
  return gate * ramp
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
 * How far the ring conveyor has advanced.
 *
 * The whole number is the count; the fraction is how far the newest has
 * travelled. Linear, because the rings are the hold's other answer to scroll —
 * an eased cadence would stall in the middle of the beat, which is exactly
 * where there is nothing else to look at.
 *
 * Past the peak it walks back by one conveyor's worth, so the ball unwinds
 * rather than freezing while it empties.
 */
export function getRingPhase(t: number): number {
  const emitted = span(t, FINALE.flip, RINGS_END) * RING_RATE
  if (t <= RINGS_END) return emitted
  return emitted - span(t, RINGS_END, RINGS_GONE) * RING_SLOTS
}

/**
 * Where the ball stops taking new rings, and where the last has left.
 *
 * Both before the climax, deliberately. The rings belong to the passage — they
 * arrive with the manifesto and leave with it — and the scene the whole
 * sequence builds to is the tunnel alone: nothing in the frame but the field at
 * its longest and fullest, and one line of type across it.
 */
const RINGS_END = 0.66
const RINGS_GONE = 0.76

/**
 * How many of the conveyor's slots are drawn.
 *
 * Rising, this is the count itself, so the rings fill the ball in one at a
 * time. Falling, it is its own signal: they leave one at a time too, in the
 * order they arrived, which is the entry played backwards rather than the ball
 * simply fading out.
 */
export function getRingLive(t: number): number {
  if (t <= RINGS_END) return getRingPhase(t)
  return RING_SLOTS * (1 - span(t, RINGS_END, RINGS_GONE))
}

/** Which of the three headlines is up, or -1 for none. */
export function getHeadlineStep(t: number): number {
  const start = 0.16
  const end = 0.44
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

/** True across the middle of the hold, where the manifesto sits around the tunnel. */
export function isManifestoUp(t: number): boolean {
  return t >= 0.48 && t < 0.68
}

/**
 * True at the climax — the one centred line the whole sequence arrives at.
 *
 * Sits over the deepest part of the tunnel by construction: the ray density
 * peaks at FINALE.peak and this window is centred on it, so the line is up
 * exactly while the field is at its longest and fullest, and leaves as it
 * starts to empty.
 */
export function isClosingUp(t: number): boolean {
  return t >= 0.68 && t < 0.87
}
