import { FINALE, FINALE_TARGET_ID, getFinaleProgress, getGrowth } from './finale-progress'
import { getTargetRect } from './rect-sampler'
import { getScrollSnapshot } from './scroll-bus'

const ABOUT_SECTION_TARGET = 'about-section'

function clamp01(value: number) {
  return value <= 0 ? 0 : value >= 1 ? 1 : value
}

function smoothstep(value: number, min: number, max: number) {
  if (max <= min) return value >= max ? 1 : 0
  const t = clamp01((value - min) / (max - min))
  return t * t * (3 - 2 * t)
}

/**
 * Fluid ownership during the Hero ↔ About hand-off.
 *
 * It is strongest while About is entering, then reaches exactly zero once
 * About has settled into the viewport. Scrolling upward naturally reverses it.
 */
export function getAboutTransitionFluidStrength(): number {
  const about = getTargetRect(ABOUT_SECTION_TARGET)
  const { viewportHeight } = getScrollSnapshot()
  if (!about?.valid || viewportHeight <= 0) return 0
  return smoothstep(about.y, 0, viewportHeight * 0.45)
}

/**
 * Fluid ownership during the finale's return leg.
 *
 * Nothing while the 3D arrow/tunnel is the active scene. Once the return leg
 * has begun and the arrow has shrunk enough to read as an exit, fluid comes
 * back behind it and is also allowed to affect the arrow itself.
 */
export function getFinaleExitFluidStrength(): number {
  const finale = getTargetRect(FINALE_TARGET_ID)
  if (!finale?.valid) return 0

  const progress = getFinaleProgress()
  if (progress <= FINALE.peak) return 0

  const growth = getGrowth(progress)
  return 1 - smoothstep(growth, 0.45, 0.9)
}

/**
 * The Contact section's own fluid mask. Standalone /contact has no finale
 * transition, so it owns the effect immediately there.
 */
export function getContactFluidStrength(): number {
  const finale = getTargetRect(FINALE_TARGET_ID)
  if (!finale?.valid) return 1

  const progress = getFinaleProgress()
  if (progress <= FINALE.peak) return 0

  const growth = getGrowth(progress)
  return 1 - smoothstep(growth, 0.18, 0.58)
}

/**
 * Region-level ownership, not pointer-motion activity.
 *
 * The neon trail reads this so it never renders at the same time as a fluid
 * cursor region. We intentionally switch ownership rather than cross-fading
 * the two cursor treatments over one another.
 */
export function isTransitionFluidRegion(): boolean {
  return (
    getAboutTransitionFluidStrength() > 0.001 ||
    getFinaleExitFluidStrength() > 0.001
  )
}
