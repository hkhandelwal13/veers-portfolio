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

import { getMidSectionPresence } from './mid-sections'

/** The whole-page rect the field is measured against. */
export const PAGE_FIELD_ID = 'page-field'

/**
 * 1 while the stickers are held, 0 while they fall — which is exactly "are we
 * in the middle of the page", so it is that signal (lib/mid-sections) rather
 * than a second copy of the same arithmetic.
 */
export function getStickerFreeze(): number {
  return getMidSectionPresence()
}

/** How far the stickers have broken up into the dot grid, 0..1. */
export function getStickerDissolve(): number {
  return getStickerFreeze()
}

