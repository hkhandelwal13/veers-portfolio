'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { advance } from '@react-three/fiber'
import { lenisOptions, prefersReducedMotion, setLenis } from '@/lib/lenis'
import { scrollState } from '@/lib/scroll-store'

gsap.registerPlugin(ScrollTrigger)

/**
 * THE render loop. There is only one (CLAUDE.md §2, §11).
 *
 * GSAP's ticker is the single rAF in the app. Each tick, in order:
 *   1. Lenis advances smooth scroll and writes the new offset to the DOM.
 *   2. ScrollTrigger recomputes against that fresh offset.
 *   3. R3F renders the WebGL scene with `advance()`.
 *
 * Because step 3 runs after steps 1–2 inside the same frame, the 3D layer reads
 * the scroll position the DOM was just painted at — so WebGL planes can never
 * lag a frame behind the cards they track. The <Canvas> is mounted with
 * frameloop="never" precisely so it has no rAF of its own.
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reduced = prefersReducedMotion()
    const lenis = new Lenis(lenisOptions(reduced))
    setLenis(lenis)

    lenis.on('scroll', (e: Lenis) => {
      scrollState.y = e.scroll
      scrollState.velocity = e.velocity
      scrollState.progress = e.progress
      scrollState.direction = e.direction
      ScrollTrigger.update()
    })

    // gsap.ticker reports seconds; Lenis and R3F both expect milliseconds.
    const tick = (time: number) => {
      const ms = time * 1000
      lenis.raf(ms)
      advance(ms)
    }

    gsap.ticker.add(tick)
    // Without this, GSAP silently clamps deltas after a tab-switch and the
    // scene snaps. We'd rather take the long frame.
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      setLenis(null)
    }
  }, [])

  return <>{children}</>
}
