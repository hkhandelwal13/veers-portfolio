/**
 * The sticker field's one journey down the page.
 *
 * They fall, clear, in the hero. They freeze where they are as the about
 * section takes over and break up into the dot matrix, and they stay frozen —
 * visible, in that broken-up form — through about, work, and the arrow's
 * approach. Then, as the arrow collapses back and the closing screen arrives,
 * they thaw out of the grid and start falling again from where they stopped.
 *
 * Two signals, both pure functions of scroll:
 *
 *   freeze    how much the fall is held, 0..1
 *   dissolve  how far into the dot matrix they are, 0..1
 *
 * They are the same number here — a sticker is frozen exactly when it is dots
 * — but they are exported separately because they drive different things and
 * the next tweak may well want them apart.
 *
 * The field is drawn by two instances, one bound to the hero's stage and one
 * to the closing screen, because each is measured against its own section's
 * rect. isStageFieldActive keeps them from overlapping: the stage's set hands
 * over the moment the closing screen's begins to arrive, and since both are
 * pure dots at that moment the swap has nothing to show.
 */

import { getContactProgress } from './contact-progress'
import { getHeroProgress } from './hero-progress'

/** Where in the hero's exit the freeze completes. */
const FREEZE_AT = 0.34

function clamp01(v: number) {
  return v <= 0 ? 0 : v >= 1 ? 1 : v
}

function smooth(v: number) {
  const t = clamp01(v)
  return t * t * (3 - 2 * t)
}

/**
 * 1 while the stickers are held, 0 while they fall.
 *
 * Rises with the hero's exit and falls again with the closing screen's arrival,
 * whichever is further along. getContactProgress runs 1 → 0 as that section
 * comes up, so the minimum of the two is "frozen unless the closing screen has
 * started to thaw them".
 */
export function getStickerFreeze(): number {
  const frozen = smooth(clamp01(getHeroProgress() / FREEZE_AT))
  const thawed = clamp01(getContactProgress())
  return Math.min(frozen, thawed)
}

/** How far the stickers have broken up into the dot grid, 0..1. */
export function getStickerDissolve(): number {
  return getStickerFreeze()
}

/**
 * Whether the stage's sticker field should draw at all.
 *
 * False once the closing screen's own field has started arriving, so the two
 * are never on screen together.
 */
export function isStageFieldActive(): boolean {
  return getContactProgress() >= 1
}
