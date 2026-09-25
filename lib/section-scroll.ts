import { getLenis, prefersReducedMotion } from './lenis'

/**
 * Scroll a home-page section through the site's one Lenis instance.
 *
 * Keeping section jumps on the same scroll source as wheel/touch input matters
 * because the WebGL layer samples the same scroll state every frame.
 */
export function scrollToSection(sectionId: string, updateHash = true): boolean {
  if (typeof window === 'undefined') return false

  const target = document.getElementById(sectionId)
  if (!target) return false

  const nav = document.querySelector<HTMLElement>('nav[aria-label="Primary"]')
  const offset = -(nav?.getBoundingClientRect().height ?? 56) - 24
  const reducedMotion = prefersReducedMotion()
  const lenis = getLenis()

  if (lenis) {
    lenis.scrollTo(target, {
      offset,
      immediate: reducedMotion,
      duration: reducedMotion ? undefined : 1.05,
    })
  } else {
    const top = target.getBoundingClientRect().top + window.scrollY + offset
    window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  if (updateHash && window.location.hash !== `#${sectionId}`) {
    window.history.pushState(null, '', `#${sectionId}`)
  }

  return true
}
