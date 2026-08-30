/**
 * DomTargetRectSampler — mirrors the DOM layout into a cache WebGL can read.
 *
 * CSS owns layout (CLAUDE.md §2); WebGL follows by reading each target's
 * on-screen rectangle. Measuring every registered element every frame would
 * mean a forced synchronous layout per element, so the cache is maintained
 * three ways instead:
 *
 *   1. Every frame, every cached rect is shifted by the frame's scroll delta.
 *      Scrolling is by far the most common reason a rect moves, and it moves
 *      every rect by exactly the same amount — so this alone keeps them right.
 *   2. Targets near the viewport are re-measured every frame anyway, because
 *      they are the ones on screen and any drift shows.
 *   3. Distant targets are re-measured roughly every 12 frames, staggered by
 *      index so they never all land on the same frame.
 *
 * Nothing here touches React state — the cache lives in module scope and is
 * read imperatively from useFrame.
 */

import type { ScrollSnapshot } from './scroll-bus'

export type TargetRect = {
  /** Viewport-space, CSS px, origin top-left — getBoundingClientRect's frame. */
  x: number
  y: number
  width: number
  height: number
  /** False until the element has been measured with a non-zero size. */
  valid: boolean
}

type Target = {
  id: string
  element: HTMLElement
  rect: TargetRect
  /** Fixed per target so staggered re-measures spread across frames. */
  stagger: number
}

/** How far outside the viewport still counts as "near" and is measured hot. */
const NEAR_MARGIN_PX = 200
/** Re-measure period for distant targets, in frames. */
const DISTANT_PERIOD = 12

const targets = new Map<string, Target>()
const listeners = new Set<() => void>()
let nextStagger = 0
let needsFullRemeasure = true

function emptyRect(): TargetRect {
  return { x: 0, y: 0, width: 0, height: 0, valid: false }
}

/**
 * Registers an element under a stable id. Returns an unregister function.
 * Re-registering the same id replaces the element and keeps the cached rect,
 * which avoids a one-frame flash when React remounts a card.
 */
export function registerTarget(id: string, element: HTMLElement) {
  const existing = targets.get(id)

  targets.set(id, {
    id,
    element,
    rect: existing?.rect ?? emptyRect(),
    stagger: existing?.stagger ?? nextStagger++ % DISTANT_PERIOD,
  })

  needsFullRemeasure = true
  notify()

  return () => {
    // Only remove if this exact element is still the registered one — a
    // remount can register the new node before the old one cleans up.
    if (targets.get(id)?.element === element) {
      targets.delete(id)
      notify()
    }
  }
}

export function getTargetRect(id: string): TargetRect | null {
  return targets.get(id)?.rect ?? null
}

export function getTargetIds(): string[] {
  return [...targets.keys()]
}

function notify() {
  for (const listener of listeners) listener()
}

/** Subscribe to registration changes — not to rect updates, which are silent. */
export function subscribeToTargets(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Forces every target to be re-measured on the next sample (resize, fonts). */
export function invalidateRects() {
  needsFullRemeasure = true
}

function measure(target: Target) {
  const box = target.element.getBoundingClientRect()
  target.rect.x = box.x
  target.rect.y = box.y
  target.rect.width = box.width
  target.rect.height = box.height
  target.rect.valid = box.width > 0 && box.height > 0
}

/**
 * Runs once per frame, before anything that consumes a rect.
 *
 * Rects are shifted by the scroll delta first so that even a target which is
 * not re-measured this frame is still correct; the re-measure passes then
 * correct for anything scrolling alone cannot explain (layout shifts,
 * sticky elements, transforms).
 */
export function sampleTargets(scroll: ScrollSnapshot) {
  if (targets.size === 0) return

  const viewportHeight = scroll.viewportHeight || window.innerHeight
  const full = needsFullRemeasure
  needsFullRemeasure = false

  for (const target of targets.values()) {
    const { rect } = target

    // 1. Scroll correction — the page moved up by `delta`, so every rect does.
    if (rect.valid && scroll.delta !== 0) {
      rect.y -= scroll.delta
    }

    if (full || !rect.valid) {
      measure(target)
      continue
    }

    // 2. Near the viewport: measure every frame.
    const near =
      rect.y < viewportHeight + NEAR_MARGIN_PX && rect.y + rect.height > -NEAR_MARGIN_PX

    if (near) {
      measure(target)
      continue
    }

    // 3. Distant: measure on its own slot in the cycle.
    if ((scroll.frame + target.stagger) % DISTANT_PERIOD === 0) {
      measure(target)
    }
  }
}

/** Test seam. */
export function resetRectSampler() {
  targets.clear()
  listeners.clear()
  nextStagger = 0
  needsFullRemeasure = true
}
