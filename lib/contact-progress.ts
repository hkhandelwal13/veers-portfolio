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
 */
const FIELD_OVERLAP = 1

export function getContactProgress(): number {
  const rect = getTargetRect(CONTACT_FIELD_ID)
  const { viewportHeight } = getScrollSnapshot()
  if (!rect || !rect.valid || viewportHeight <= 0) return 1

  // 1 while its top edge is still below the fold, falling to 0 by the time the
  // section has risen a third of the way up the screen.
  const sectionTop = rect.y + viewportHeight * FIELD_OVERLAP
  const raw = sectionTop / (viewportHeight * 0.66)
  return raw <= 0 ? 0 : raw >= 1 ? 1 : raw
}
