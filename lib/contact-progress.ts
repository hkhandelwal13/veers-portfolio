/**
 * The closing screen's ground arriving.
 *
 * Runs the opposite way to the hero's: the page above it has already turned
 * --section-ground, so this section starts fully handed over and un-dissolves
 * into its own blue as it fills the viewport. Scrolled past the hero it would
 * otherwise appear as a hard colour change at its top edge.
 */

import { getTargetRect } from './rect-sampler'
import { getScrollSnapshot } from './scroll-bus'

export const CONTACT_FIELD_ID = 'contact-field'

/**
 * How far the field's rect reaches above the section, in viewports.
 *
 * Mirrors the negative top inset on .fieldTarget in Contact.module.css — see
 * the note there. Subtracted back off below so the dissolve keys off the
 * section's own top edge rather than the extended rect's.
 *
 * It also sets when the closing screen's stickers start falling, since they are
 * bound to the same rect: too much of it and they drift through the finale's
 * tunnel, which is somewhere else entirely.
 */
export const CONTACT_FIELD_OVERLAP = 1.6

export function getContactProgress(): number {
  const rect = getTargetRect(CONTACT_FIELD_ID)
  const { viewportHeight } = getScrollSnapshot()
  if (!rect || !rect.valid || viewportHeight <= 0) return 1

  // 1 while its top edge is more than a screen and a half below the fold,
  // falling to 0 by the time the section has risen to it.
  //
  // The reach is what decides when the dot matrix starts, and it has to start
  // before the arrow has finished collapsing: the closing frame of the finale
  // is the small arrow standing in a field that is already up, not one that
  // begins arriving underneath it. The arrow is still bigger than the frame at
  // that point, so nothing shows through until it is not.
  const sectionTop = rect.y + viewportHeight * CONTACT_FIELD_OVERLAP
  const raw = sectionTop / (viewportHeight * 1.65)
  return raw <= 0 ? 0 : raw >= 1 ? 1 : raw
}
