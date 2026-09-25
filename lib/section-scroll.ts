import { getLenis, prefersReducedMotion } from './lenis'

function absoluteTop(element: HTMLElement): number {
  return element.getBoundingClientRect().top + window.scrollY
}

function destinationFor(sectionId: string, target: HTMLElement, navHeight: number): number {
  if (sectionId === 'hero') return 0

  const viewportHeight = window.innerHeight

  if (sectionId === 'contact') {
    // ContactWord becomes fully upright exactly when the slot centre meets the
    // viewport centre, so the nav jump lands on that same designed pose.
    const wordmark = target.querySelector<HTMLElement>('[data-webgl="wordmark"]')
    if (wordmark) {
      const rect = wordmark.getBoundingClientRect()
      return Math.max(0, absoluteTop(wordmark) + rect.height / 2 - viewportHeight / 2)
    }
  }

  if (sectionId === 'about') {
    const focus = target.querySelector<HTMLElement>('[data-scroll-focus]') ?? target
    const rect = focus.getBoundingClientRect()
    const availableHeight = viewportHeight - navHeight - 48

    // Centre the actual composition when it fits. On short screens where the
    // composition is taller than the visible area, align its top below chrome
    // rather than hiding the first part above the viewport.
    if (rect.height <= availableHeight) {
      const visibleCentre = navHeight + (viewportHeight - navHeight) / 2
      return Math.max(0, absoluteTop(focus) + rect.height / 2 - visibleCentre)
    }

    return Math.max(0, absoluteTop(focus) - navHeight - 24)
  }

  return Math.max(0, absoluteTop(target) - navHeight - 24)
}

/**
 * Scroll a home-page section through the site's one Lenis instance.
 *
 * Section jumps use the same scroll source as wheel/touch input so the DOM and
 * WebGL scene stay in lock-step throughout the animation.
 */
export function scrollToSection(sectionId: string, updateHash = true): boolean {
  if (typeof window === 'undefined') return false

  const target = document.getElementById(sectionId)
  if (!target) return false

  const nav = document.querySelector<HTMLElement>('nav[aria-label="Primary"]')
  const navHeight = nav?.getBoundingClientRect().height ?? 56
  const top = destinationFor(sectionId, target, navHeight)
  const reducedMotion = prefersReducedMotion()
  const lenis = getLenis()

  if (lenis) {
    lenis.scrollTo(top, {
      immediate: reducedMotion,
      duration: reducedMotion ? undefined : 1.05,
    })
  } else {
    window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  if (updateHash && window.location.hash !== `#${sectionId}`) {
    window.history.pushState(null, '', `#${sectionId}`)
  }

  return true
}
