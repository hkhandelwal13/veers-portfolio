'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import { lenisOptions, prefersReducedMotion, setLenis } from '@/lib/lenis'
import { attachPointerBus } from '@/lib/pointer-bus'
import { watchCapabilities } from '@/lib/capabilities'
import { enableFrameLoopFallback } from '@/lib/frame-loop'
import { invalidateRects } from '@/lib/rect-sampler'

/**
 * Owns the Lenis instance and the pointer listeners — but not the frame loop.
 *
 * Lenis runs with autoRaf:false and is ticked by lib/frame-loop, which R3F
 * drives via addEffect so scroll and render land in the same frame. This
 * provider only enables the fallback driver, which runs until the canvas claims
 * the loop and resumes if it ever unmounts. See lib/frame-loop.ts.
 *
 * Deliberately imports nothing from three or @react-three/fiber: it renders on
 * every page, and pulling the WebGL runtime into the main bundle would defeat
 * the dynamic, canvas-only import.
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis(lenisOptions(prefersReducedMotion()))
    setLenis(lenis)

    const detachPointer = attachPointerBus()
    // Effect shutoffs read from here. Until this runs, capabilities hold their
    // server defaults — which deliberately assume no hover — so every gated
    // effect stays off rather than flashing on before we know the device.
    const unwatchCapabilities = watchCapabilities()
    const disableFallback = enableFrameLoopFallback()

    // Anything that reflows the page invalidates every cached rect. Lenis
    // recalculates its own dimensions on resize; this covers the WebGL side.
    const onResize = () => invalidateRects()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    // Late-loading fonts are the classic silent reflow.
    document.fonts?.ready.then(invalidateRects)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      disableFallback()
      unwatchCapabilities()
      detachPointer()
      lenis.destroy()
      setLenis(null)
    }
  }, [])

  return <>{children}</>
}
