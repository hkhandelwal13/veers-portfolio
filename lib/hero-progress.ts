/**
 * How far the hero has been scrolled away — 0 at rest, 1 once it is gone.
 *
 * One number drives the whole exit choreography: the word shrinks and turns on
 * it, the stickers shrink and fade on it, and the background dissolves into a
 * dot matrix on it. Deriving it in one place is what keeps those three moving
 * as one gesture rather than three animations that happen to overlap.
 *
 * A derived read rather than a stored value, so it needs no place in the frame
 * order: the ScrollBus was already written this frame (frame-loop step 2), and
 * everything below runs later. Any two callers in the same frame get the same
 * answer by construction.
 *
 * It assumes the hero sits at the top of the document, which it does — the
 * only screen with one is the home page. Consumers all bail when the hero's
 * rect is absent, so the value is never read anywhere it would be wrong.
 */

import { getScrollSnapshot } from './scroll-bus'

/** Scroll distance the exit is spread over, as a share of the viewport. */
const TRAVEL = 1.35

/**
 * The objects lag the ground.
 *
 * The background starts turning immediately, but the word and the stickers hold
 * their shape for a moment and then break up. Dissolving everything on exactly
 * the same curve means the word is gone before there is enough of a dot field
 * to see it dissolve into.
 *
 * Both are finished well before the travel is, on purpose: the next section's
 * top edge is on screen from the very first pixel of scroll, and anything still
 * resolving by then is resolving over the top of it.
 */
export function getHeroObjectDissolve(): number {
  const p = getHeroProgress()
  const t = (p - 0.06) / 0.3
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
}

export function getHeroProgress(): number {
  const { scrollTop, viewportHeight } = getScrollSnapshot()
  if (viewportHeight <= 0) return 0
  const raw = scrollTop / (viewportHeight * TRAVEL)
  return raw <= 0 ? 0 : raw >= 1 ? 1 : raw
}
