import Lenis from 'lenis'

/**
 * Lenis options + a module-level handle to the single instance.
 *
 * There is exactly one Lenis instance for the whole app, created by
 * <SmoothScrollProvider>. Anything that needs to control scrolling
 * (menu open/close, page transitions, anchor links) should call getLenis()
 * rather than constructing its own — a second instance would mean a second
 * scroll loop, which CLAUDE.md §11 forbids.
 */

let instance: Lenis | null = null

export function setLenis(next: Lenis | null) {
  instance = next
}

export function getLenis(): Lenis | null {
  return instance
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Reduced motion gets native scrolling: Lenis stays mounted so the rest of the
 * app can keep reading its events, but it stops interpolating wheel/touch.
 */
export function lenisOptions(reducedMotion: boolean): ConstructorParameters<typeof Lenis>[0] {
  return {
    // We tick Lenis ourselves from the one shared loop.
    autoRaf: false,
    lerp: reducedMotion ? 1 : 0.1,
    smoothWheel: !reducedMotion,
    wheelMultiplier: 1,
    touchMultiplier: 1.6,
    // Touch devices keep native momentum; it feels better than emulated inertia.
    syncTouch: false,
  }
}
