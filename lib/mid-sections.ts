/**
 * How far into the middle of the page we are — about, work, and the arrow.
 *
 * 0 in the hero and on the closing screen, 1 between them. Two things key off
 * it and they are the same idea seen twice: the stickers hold still there
 * (lib/sticker-journey), and the pointer leaves a pixel trail there
 * (components/webgl/PointerTrail). The hero and the closing screen are the two
 * places with a glass object as the subject, and neither wants anything else
 * competing with it.
 *
 * Built from the two section signals that already exist rather than from
 * rects of its own: the hero's exit runs 0 → 1 as it leaves, and the closing
 * screen's runs 1 → 0 as it arrives, so the smaller of the two is "out of the
 * hero and not yet in contact".
 */

import { getContactProgress } from './contact-progress'
import { getHeroProgress } from './hero-progress'

/**
 * How far through the hero's exit the middle has fully taken over.
 *
 * Nearly all of it. At a third the hold was more than half on by the time you
 * had scrolled a fifth of the hero — so the stickers spent most of the section
 * they are supposed to be falling through already stiffening, and the fall
 * never read as the start of a journey. This lands the hold as the about
 * section arrives, which is the section that actually wants them still.
 */
const ENTER_AT = 0.85

function clamp01(v: number) {
  return v <= 0 ? 0 : v >= 1 ? 1 : v
}

function smooth(v: number) {
  const t = clamp01(v)
  return t * t * (3 - 2 * t)
}

export function getMidSectionPresence(): number {
  const past = smooth(clamp01(getHeroProgress() / ENTER_AT))
  const before = clamp01(getContactProgress())
  return Math.min(past, before)
}
