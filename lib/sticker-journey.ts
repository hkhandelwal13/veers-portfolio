/**
 * The sticker field's one journey down the page.
 *
 * They fall, clear, in the hero. They freeze where they are as the about
 * section takes over and break up into the dot matrix, and they stay frozen —
 * visible, in that broken-up form — through about and work. The arrow section
 * thaws them again on its way in, so the fall resumes there, pauses only for
 * as long as the tunnel is over them, and carries on down the closing screen.
 *
 * One journey, top of the page to the bottom, held still twice in the middle —
 * rather than held still for everything between the two ends.
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

import { getFinaleArrival, getFinaleProgress, getPortalMix } from './finale-progress'
import { getMidSectionPresence } from './mid-sections'

/** The whole-page rect the field is measured against. */
export const PAGE_FIELD_ID = 'page-field'

/**
 * 1 while the stickers are held, 0 while they fall — which is exactly "are we
 * in the middle of the page", so it is that signal (lib/mid-sections) rather
 * than a second copy of the same arithmetic.
 */
export function getStickerFreeze(): number {
  // Released again over the arrow section's approach. Without this the hold
  // covers everything between the hero and the closing screen, which is most
  // of the page: the stickers spend longer frozen than falling, and the fall
  // reads as two short bursts at the ends rather than as one journey down.
  return getMidSectionPresence() * (1 - getFinaleArrival())
}

/** How far the stickers have broken up into the dot grid, 0..1. */
export function getStickerDissolve(): number {
  return getStickerFreeze()
}


/**
 * How much the arrow's tunnel hides them, 0..1.
 *
 * The field runs the whole page, so without this the frozen stickers are still
 * sitting there inside the finale — dotted rectangles drifting behind the rays,
 * which belong to neither thing. They are not wanted *in* that scene; they are
 * wanted on either side of it.
 *
 * Keyed to the portal rather than to the section, so it is the tunnel opening
 * that takes them and the tunnel closing that gives them back. That keeps the
 * two ends of the journey intact — frozen and visible through the arrow's
 * approach, frozen and visible again as it collapses over the closing screen —
 * and being a pure function of the same growth every other finale signal reads,
 * it unwinds exactly on the way back up.
 */
export function getStickerVeil(): number {
  return getPortalMix(getFinaleProgress())
}
