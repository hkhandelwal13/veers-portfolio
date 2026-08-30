'use client'

import { useFrame } from '@react-three/fiber'
import { sampleTargets } from '@/lib/rect-sampler'
import { getScrollSnapshot } from '@/lib/scroll-bus'

/**
 * Runs the DomTargetRectSampler once per frame, before anything reads a rect.
 *
 * Priority -3 orders this ahead of the default (0) subscribers that consume the
 * cache. Negative priorities only affect ordering: R3F counts a subscriber as
 * "taking over rendering" only when its priority is greater than zero, so this
 * does not disable automatic rendering.
 */
export function RectSampler() {
  useFrame(() => {
    sampleTargets(getScrollSnapshot())
  }, -3)

  return null
}
