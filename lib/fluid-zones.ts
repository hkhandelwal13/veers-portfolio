/**
 * Where the fluid distortion applies, as one 0..1 scalar.
 *
 * The site is a single WebGL stage — one canvas, one scene, sections scrolling
 * over it — so "put the effect on three sections" cannot mean three pipelines.
 * It means one compositor whose strength is a function of which section is on
 * screen, and this is that function.
 *
 * Three places, per the brief: the hero, the arrow's exit from the finale, and
 * the closing screen. Everything between them is zero, and at exactly zero the
 * compositor is skipped altogether (see FluidDistortion) — so the middle of the
 * page pays nothing for this at all.
 *
 * Coverage rather than a boolean: the strength is the share of the viewport the
 * section fills, so the distortion arrives and leaves with the section instead
 * of switching on at a threshold and popping.
 */

import { CONTACT_FIELD_ID, CONTACT_FIELD_OVERLAP } from './contact-progress'
import { FINALE, getFinaleProgress, isFinaleVisible } from './finale-progress'
import { getTargetRect, type TargetRect } from './rect-sampler'
import { getScrollSnapshot } from './scroll-bus'

/** The hero section's own rect. */
const HERO_FIELD_ID = 'hero-field'

function clamp01(v: number) {
  return v <= 0 ? 0 : v >= 1 ? 1 : v
}

function smooth(v: number) {
  const t = clamp01(v)
  return t * t * (3 - 2 * t)
}

/** How much of the viewport a rect fills, 0..1. */
function coverage(rect: TargetRect | null, viewportHeight: number, topOffset = 0) {
  if (!rect || !rect.valid) return 0
  const top = Math.max(rect.y + topOffset, 0)
  const bottom = Math.min(rect.y + rect.height, viewportHeight)
  return clamp01((bottom - top) / viewportHeight)
}

export function getFluidStrength(): number {
  const { viewportHeight } = getScrollSnapshot()
  if (viewportHeight <= 0) return 0

  const hero = coverage(getTargetRect(HERO_FIELD_ID), viewportHeight)

  // The closing screen's ground reaches well above its own section so the dot
  // matrix is up before the arrow uncovers it; that overhang is not the section
  // and must not turn the effect on inside the finale's tunnel.
  const contact = coverage(
    getTargetRect(CONTACT_FIELD_ID),
    viewportHeight,
    viewportHeight * CONTACT_FIELD_OVERLAP,
  )

  // The arrow's exit: from the climax to the release, which is the stretch
  // where it turns back down through reading size and hands over.
  const exit = isFinaleVisible()
    ? smooth(clamp01((getFinaleProgress() - FINALE.peak) / (1 - FINALE.peak)))
    : 0

  return Math.max(hero, contact, exit)
}
