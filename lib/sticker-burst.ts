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
 * own. Charge does two things — it pulls the falling stickers toward the point
 * you clicked, and it reveals a reserve of extra ones that are otherwise
 * invisible, a few more with each click. Stop clicking and it drains, the
 * extras go back to nothing, and the field is exactly where it would have been
 * if you had never clicked: the fall itself never stops, so nothing has to be
 * restored, it simply stops being pulled.
 *
 * A module-level reading rather than React state, for the same reason as the
 * pointer bus: this is read once per frame by WebGL, and a re-render per click
 * would be a re-render of the whole canvas tree.
 */

import { getMidSectionPresence } from './mid-sections'

export type StickerBurstReading = {
  /** 0..1. How gathered the field is — sum of recent clicks, always draining. */
  charge: number
  /** Where they are gathering, 0..1 across and down the viewport. */
  x: number
  y: number
}

/** Per click. Four or five clicks reach full strength. */
const CLICK_GAIN = 0.26
/** Share of the charge left after one second of not clicking. */
const RETENTION = 0.3
/**
 * How fast the gathering point slides to a new click.
 *
 * Not instant: clicking somewhere else should drag the cluster across rather
 * than teleport it, because the stickers are already on their way to the old
 * point and a jump leaves them scattered between the two.
 */
const POINT_CHASE = 7

const reading: StickerBurstReading = { charge: 0, x: 0.5, y: 0.5 }
/** What callers see — the stored reading, gated by where the page is. */
const gated: StickerBurstReading = { charge: 0, x: 0.5, y: 0.5 }
const target = { x: 0.5, y: 0.5 }

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

  const width = window.innerWidth || 1
  const height = window.innerHeight || 1
  target.x = event.clientX / width
  target.y = event.clientY / height
  // The first click of a burst places the cluster rather than dragging it.
  if (reading.charge < 0.02) {
    reading.x = target.x
    reading.y = target.y
  }
  reading.charge = Math.min(1, reading.charge + CLICK_GAIN)
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

/** Drains the charge and eases the point. Driven from the one frame loop. */
export function updateStickerBurst(deltaSeconds: number) {
  if (reading.charge <= 0 && reading.x === target.x && reading.y === target.y) return
  // Per second, not per frame: the same constant has to drain in the same wall
  // time at 8fps as at 120.
  const delta = Math.min(deltaSeconds, 1 / 15)
  reading.charge *= Math.pow(RETENTION, delta)
  if (reading.charge < 0.001) reading.charge = 0

  const chase = 1 - Math.exp(-POINT_CHASE * delta)
  reading.x += (target.x - reading.x) * chase
  reading.y += (target.y - reading.y) * chase
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
  ;(window as unknown as { __stickerBurst?: () => StickerBurstReading }).__stickerBurst = () => ({
    charge: reading.charge,
    x: reading.x,
    y: reading.y,
  })
}

export function getStickerBurst(): StickerBurstReading {
  // Derived into a separate object, never written back: the gate is a function
  // of where you are, so folding it into the stored charge would spend the
  // charge just for having scrolled past — and would spend it again on every
  // call within the same frame.
  gated.charge = reading.charge * (1 - getMidSectionPresence())
  gated.x = reading.x
  gated.y = reading.y
  return gated
}
