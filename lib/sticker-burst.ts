/**
 * Clicking the background gathers stickers where you clicked.
 *
 * Only on the hero and the closing screen. Those are the two places the field
 * is falling and the page has no other job — everywhere between them the
 * stickers are frozen into the dot matrix and the pointer already has the
 * pixel trail (lib/mid-sections), so a second pointer effect there would be
 * two things competing for the same gesture.
 *
 * The shape of it: every click adds charge; charge decays back to zero on its
 * own. Charge does one thing — it calls up a reserve of stickers that are
 * otherwise invisible, a few more with each click, each swelling into the
 * field from nothing to full size. Where you clicked is not part of it. An
 * earlier version pulled the whole field to the point you clicked and piled it
 * up there, which is a burst rather than an arrival, and it left the rest of
 * the screen bare. Stop clicking and the charge drains, the reserve shrinks
 * back out, and the field is exactly where it would have been if you had never
 * clicked: the fall itself never stops, so nothing has to be restored.
 *
 * A module-level reading rather than React state, for the same reason as the
 * pointer bus: this is read once per frame by WebGL, and a re-render per click
 * would be a re-render of the whole canvas tree.
 */

import { getMidSectionPresence } from './mid-sections'

/** Per click. Four or five clicks reach full strength. */
const CLICK_GAIN = 0.26
/** Share of the charge left after one second of not clicking. */
const RETENTION = 0.3

/** 0..1 — the sum of recent clicks, always draining. */
let charge = 0

/** Interactive things the page already uses this gesture for. */
const INTERACTIVE = 'a, button, input, textarea, select, label, summary, [role="button"]'

function onPointerDown(event: PointerEvent) {
  // Primary button only — a right-click is a context menu, not a gesture.
  if (event.button !== 0) return
  const element = event.target as Element | null
  if (element?.closest?.(INTERACTIVE)) return
  // Outside the hero and the closing screen this does nothing, so do not even
  // record it: charge picked up in the middle of the page would arrive with
  // you when you reached the bottom.
  if (getMidSectionPresence() > 0.5) return

  charge = Math.min(1, charge + CLICK_GAIN)
}

let listeners = 0

/**
 * Starts listening, and stops when the last caller releases it.
 *
 * Ref-counted because the field may be drawn by more than one component and
 * each will ask for this; two listeners would mean two lots of charge per
 * click.
 */
export function installStickerBurst(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (listeners === 0) window.addEventListener('pointerdown', onPointerDown, { passive: true })
  listeners += 1
  let released = false
  return () => {
    if (released) return
    released = true
    listeners -= 1
    if (listeners === 0) window.removeEventListener('pointerdown', onPointerDown)
  }
}

/** Drains the charge. Driven from the one frame loop. */
export function updateStickerBurst(deltaSeconds: number) {
  if (charge <= 0) return
  // Per second, not per frame: the same constant has to drain in the same wall
  // time at 8fps as at 120.
  charge *= Math.pow(RETENTION, Math.min(deltaSeconds, 1 / 15))
  if (charge < 0.001) charge = 0
}

/**
 * The reading for this frame.
 *
 * Gated by where you are on the page as well as by the charge, so a burst
 * cannot survive a scroll into the middle of the site: the same signal that
 * freezes the stickers there closes this down.
 */
/**
 * Dev-only readout.
 *
 * Temporal effects cannot be verified from screenshots on a headless renderer
 * — it runs at a few frames a second, which makes a correctly-draining signal
 * look like a stuck one. Reading the number directly is the only honest test.
 * Stripped from production builds by the constant condition.
 */
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __stickerBurst?: () => number }).__stickerBurst = () => charge
}

export function getStickerBurst(): number {
  // Derived, never written back: the gate is a function of where you are, so
  // folding it into the stored charge would spend the charge just for having
  // scrolled past — and would spend it again on every call within the frame.
  return charge * (1 - getMidSectionPresence())
}
