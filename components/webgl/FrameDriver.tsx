'use client'

import { useEffect } from 'react'
import { addEffect } from '@react-three/fiber'
import { claimFrameLoop, releaseFrameLoop, runFrame } from '@/lib/frame-loop'

/**
 * Hands the frame loop to R3F.
 *
 * addEffect callbacks run in R3F's global loop *before* any useFrame subscriber
 * and before the render — verified against the installed version, where
 * flushGlobalEffects('before') precedes the subscriber walk and gl.render. So
 * the order within one frame is:
 *
 *   addEffect (here)        lenis.raf → ScrollBus → PointerBus
 *   useFrame(-3)            DomTargetRectSampler reads fresh rects
 *   useFrame(0)             meshes consume those rects
 *   gl.render               the frame is drawn
 *
 * which is why WebGL can never be a frame behind the DOM.
 *
 * Claiming the loop also stops the provider's fallback rAF, so there is exactly
 * one driver at a time; releasing on unmount hands scrolling back.
 */
export function FrameDriver() {
  useEffect(() => {
    claimFrameLoop()
    const removeEffect = addEffect((timeMs: number) => {
      runFrame(timeMs)
    })

    // Reaching here means the GL context was created and the scene mounted, so
    // the CSS placeholders can stand down and let WebGL supply the image.
    document.documentElement.dataset.webgl = 'live'

    return () => {
      removeEffect()
      releaseFrameLoop()
      delete document.documentElement.dataset.webgl
    }
  }, [])

  return null
}
