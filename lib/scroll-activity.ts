/**
 * Smoothed scroll speed, 0..1 — the signal behind the scroll-velocity curl.
 *
 * Derived once per frame from the ScrollBus, straight after it is written, so
 * every consumer reads the same number for the same frame. Computing it inside
 * each card would give the same answer four times over and risk them drifting
 * apart if one ever sampled at a different point in the frame.
 *
 * Two details make it usable rather than twitchy:
 *
 *   - dt is clamped. A backgrounded tab waking up reports one enormous frame,
 *     and dividing a large scroll delta by a near-zero dt would spike the
 *     signal to full on the first frame back.
 *   - attack is fast, release is slow. A trackpad produces a lot of small
 *     velocity fluctuations; a single time constant turns those into visible
 *     flicker, whereas rising quickly and falling gently reads as momentum.
 */

import type { ScrollSnapshot } from './scroll-bus'

/** px/s that counts as "full speed". */
const FULL_SPEED = 900
/** Seconds. Rising toward a faster scroll. */
const TAU_ATTACK = 0.025
/** Seconds. Falling back to rest — deliberately slower. */
const TAU_RELEASE = 0.175

const MIN_DT = 1 / 240
const MAX_DT = 0.1

let activity = 0

/** Called once per frame by the frame loop. Returns the smoothed 0..1 value. */
export function updateScrollActivity(scroll: ScrollSnapshot, deltaSeconds: number): number {
  const dt = Math.min(Math.max(deltaSeconds, MIN_DT), MAX_DT)
  const speed = Math.abs(scroll.delta) / dt
  const target = Math.min(speed / FULL_SPEED, 1)

  const tau = target > activity ? TAU_ATTACK : TAU_RELEASE
  activity += (target - activity) * (1 - Math.exp(-dt / tau))

  // Settle exactly, so an idle page stops uploading a uniform that is only
  // ever going to be 0.0001.
  if (activity < 0.0005) activity = 0

  return activity
}

export function getScrollActivity(): number {
  return activity
}

/**
 * Publishes the same signal to CSS, as --scroll-curl.
 *
 * The DOM-synced cards get the real thing — a per-pixel UV compression in the
 * card shader. Everything the canvas does not mirror (the About portrait, which
 * is a plain <img> until a depth map exists for it) can still answer scroll
 * speed from CSS, and this is the one number both halves read.
 *
 * Quantised to two decimals and written only on change: a custom property that
 * feeds a transform invalidates style on every write, and an idle page should
 * not be paying for a value that is only ever going to be 0.0001 different.
 */
let published = -1

export function publishScrollActivity() {
  const value = Math.round(activity * 100) / 100
  if (value === published) return
  published = value
  document.documentElement.style.setProperty('--scroll-curl', String(value))
}

/** Test seam. */
export function resetScrollActivity() {
  activity = 0
  published = -1
}
