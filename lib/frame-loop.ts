/**
 * The one frame loop.
 *
 * Everything time-based in the app advances here, in a fixed order, once per
 * frame (CLAUDE.md §2, §11):
 *
 *   1. lenis.raf()          — smooth scroll advances and writes the DOM
 *   2. updateScrollBus      — records what Lenis just produced, for this frame
 *   3. updateScrollActivity — smooths that into the 0..1 speed signal
 *   4. commitPointerBus     — eases the pointer, republishes its snapshot
 *   5. updatePointerVelocity — the fluid simulation's only input
 *   6. onFrame listeners    — DOM-side per-frame work (the cursor)
 *
 * WebGL then renders later in the same frame, reading the snapshot from step 2.
 * That ordering is the whole point: it is what removes the one-frame slip you
 * get when Lenis and R3F each own a requestAnimationFrame and R3F happens to
 * run first, reading last frame's scroll while the DOM has already moved.
 *
 * ── Who drives it ────────────────────────────────────────────────────────────
 * Normally R3F does, via addEffect (see components/webgl/FrameDriver.tsx), so
 * scroll and render are provably in the same frame. But the canvas is loaded
 * dynamically and may never mount — no WebGL support, a failed chunk, an older
 * device. Lenis with autoRaf:false that nobody ticks is a page that cannot
 * scroll at all, so a fallback rAF here drives the loop until a host claims it,
 * and takes over again if that host goes away. Exactly one of the two runs at
 * any moment.
 */

import { getLenis } from './lenis'
import { commitPointerBus } from './pointer-bus'
import { updatePointerVelocity } from './pointer-velocity'
import { updateScrollActivity } from './scroll-activity'
import { updateScrollBus } from './scroll-bus'

/**
 * DOM-side per-frame work — the cursor, and anything else that animates outside
 * the canvas. WebGL uses R3F's own useFrame, which runs later in this same
 * frame; this list is for the things that must work whether or not a canvas
 * ever mounts.
 */
const frameListeners = new Set<(deltaSeconds: number) => void>()

export function onFrame(listener: (deltaSeconds: number) => void) {
  frameListeners.add(listener)
  return () => {
    frameListeners.delete(listener)
  }
}

let lastTimeMs = 0
let hostClaimed = false
let fallbackHandle: number | null = null
let fallbackWanted = false

/**
 * Advances one frame. `timeMs` must be a monotonic millisecond clock — R3F and
 * requestAnimationFrame both provide one.
 */
export function runFrame(timeMs: number) {
  // First frame has no previous timestamp; assume 60fps rather than 0, which
  // would make every damp() a no-op.
  const deltaSeconds = lastTimeMs === 0 ? 1 / 60 : (timeMs - lastTimeMs) / 1000
  lastTimeMs = timeMs

  const lenis = getLenis()
  lenis?.raf(timeMs)

  // Read straight after raf() rather than binding lenis.on('scroll'): the event
  // only fires when the offset actually changes, and the bus also wants a
  // reading on the frames where it did not.
  const scroll = updateScrollBus(lenis)

  // Derived here, once, so every consumer of the curl reads the same number
  // for the same frame.
  updateScrollActivity(scroll, deltaSeconds)

  commitPointerBus(deltaSeconds)
  // Straight after, so the velocity is measured against the position the bus
  // has just published rather than the previous frame's.
  updatePointerVelocity(deltaSeconds)

  // Last, so DOM listeners see the scroll and pointer readings this frame
  // produced rather than the previous one's.
  for (const listener of frameListeners) listener(deltaSeconds)
}

function tickFallback(timeMs: number) {
  fallbackHandle = null
  if (hostClaimed || !fallbackWanted) return
  runFrame(timeMs)
  fallbackHandle = requestAnimationFrame(tickFallback)
}

function startFallback() {
  if (hostClaimed || !fallbackWanted || fallbackHandle !== null) return
  fallbackHandle = requestAnimationFrame(tickFallback)
}

function stopFallback() {
  if (fallbackHandle !== null) {
    cancelAnimationFrame(fallbackHandle)
    fallbackHandle = null
  }
}

/**
 * Starts the fallback driver. Called by the smooth-scroll provider on mount;
 * it stays dormant while a host holds the claim.
 */
export function enableFrameLoopFallback() {
  fallbackWanted = true
  startFallback()

  return () => {
    fallbackWanted = false
    stopFallback()
  }
}

/**
 * A host (R3F) takes over driving. Idempotent — the last claimer wins, and the
 * fallback stays out of the way until it is released.
 */
export function claimFrameLoop() {
  hostClaimed = true
  stopFallback()
}

/** The host is going away; hand back to the fallback if it is still wanted. */
export function releaseFrameLoop() {
  hostClaimed = false
  startFallback()
}

export function isFrameLoopClaimed() {
  return hostClaimed
}

/** Test seam. */
export function resetFrameLoop() {
  stopFallback()
  hostClaimed = false
  fallbackWanted = false
  lastTimeMs = 0
}
