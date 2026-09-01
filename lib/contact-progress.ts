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

export function getContactProgress(): number {
  const rect = getTargetRect(CONTACT_FIELD_ID)
  const { viewportHeight } = getScrollSnapshot()
  if (!rect || !rect.valid || viewportHeight <= 0) return 1

  // 1 while its top edge is still below the fold, falling to 0 by the time the
  // section has risen a third of the way up the screen.
  const raw = rect.y / (viewportHeight * 0.66)
  return raw <= 0 ? 0 : raw >= 1 ? 1 : raw
}
