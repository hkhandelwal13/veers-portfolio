/**
 * Clicking the background adds stickers to the field.
 *
 * Only the hero and the closing screen answer the click. Those are the two
 * places the field is falling and the page has no other job — everywhere
 * between them the stickers are frozen into the dot matrix and the pointer
 * already has the pixel trail (lib/mid-sections), so a second pointer effect
 * there would be two things competing for the same gesture.
 *
 * What a click does is add, and only add. Each one wakes a few more of a
 * reserve that starts out invisible; they swell up from nothing to full size
 * where they are and then they are simply part of the field — same fall, same
 * drift, same sway, indistinguishable from the ones that were always there.
 *
 * Which is why this is a count and not a level. Two earlier versions were a
 * charge that drained: the first pulled the whole field into a pile at the
 * pointer, which is a burst rather than an arrival, and the second left the
 * new stickers shrinking away again a second after they appeared — they never
 * got to be part of anything. A number that only goes up has neither problem
 * and needs no frame loop to maintain.
 *
 * A module-level count rather than React state, for the same reason as the
 * pointer bus: it is read once per frame by WebGL, and a re-render per click
 * would be a re-render of the whole canvas tree.
 */

import { getMidSectionPresence } from './mid-sections'

/**
 * Stickers woken per click.
 *
 * Enough that one click is visibly something, small enough that filling the
 * reserve takes a while — the effect is meant to reward carrying on, not to
 * be over in two taps.
 */
const PER_CLICK = 5

/** How many of the reserve are awake. Only ever rises. */
let spawned = 0
/** The size of the reserve, set by the field that owns it. */
let capacity = 0

/** Interactive things the page already uses this gesture for. */
const INTERACTIVE = 'a, button, input, textarea, select, label, summary, [role="button"]'

function onPointerDown(event: PointerEvent) {
  // Primary button only — a right-click is a context menu, not a gesture.
  if (event.button !== 0) return
  const element = event.target as Element | null
  if (element?.closest?.(INTERACTIVE)) return
  // The middle of the page does not answer this gesture — see above.
  if (getMidSectionPresence() > 0.5) return

  spawned = Math.min(capacity, spawned + PER_CLICK)
}

let listeners = 0

/**
 * Starts listening, and stops when the last caller releases it.
 *
 * Ref-counted because the field may be drawn by more than one component and
 * each will ask for this; two listeners would mean two lots of stickers per
 * click. `reserve` is how many the caller has to give.
 */
export function installStickerBurst(reserve: number): () => void {
  if (typeof window === 'undefined') return () => {}
  capacity = Math.max(capacity, reserve)
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

/**
 * Dev-only readout.
 *
 * Screenshots of this on a headless renderer are hard to read — it runs at a
 * few frames a second and the stickers are mid-swell in most of them. Reading
 * the number directly is the honest test. Stripped from production builds by
 * the constant condition.
 */
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __stickerBurst?: () => number }).__stickerBurst = () => spawned
}

/** How many of the reserve are awake, for the field to draw. */
export function getStickerSpawn(): number {
  return spawned
}
