'use client'

import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { getTargetRect } from '@/lib/rect-sampler'
import { getScrollSnapshot } from '@/lib/scroll-bus'
import { pointer } from '@/lib/pointer-bus'
import { prefersReducedMotion } from '@/lib/lenis'
import { Hello } from './Hello'
import { isRectVisible, rectToWorld } from './rect-space'

export const HERO_TARGET_ID = 'hero-hello'

/** Idle float, as a fraction of the seated height — small enough to read as breathing. */
const FLOAT_AMPLITUDE = 0.02
/** Pointer parallax, in radians. */
const TILT_X = 0.1
const TILT_Y = 0.16

/**
 * Seats the `hello` model in its DOM-defined box and keeps it there.
 *
 * The model is not placed in world coordinates by hand. Every frame it reads
 * the rect the sampler measured for `data-webgl="hero-hello"` and converts it
 * to world space, so CSS keeps deciding where the hero sits at every
 * breakpoint — the 3D layer has no opinion and no media queries.
 *
 * Because the sampler runs at useFrame priority -3 and the ScrollBus was
 * written before that by the frame driver, the rect read here is the one that
 * matches the DOM position this very frame. That is what keeps the model glued
 * during a fast scroll instead of trailing it.
 *
 * Material is still the model's baked `water_material3` — glass is Phase 4.
 */
export function HeroHello() {
  const outer = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const bounds = useRef<{ size: THREE.Vector3; center: THREE.Vector3 } | null>(null)
  const reduced = useRef(false)

  const camera = useThree((state) => state.camera)

  useLayoutEffect(() => {
    reduced.current = prefersReducedMotion()
  }, [])

  // Measure once — the geometry never changes. The GLB carries a baked,
  // off-origin transform, so the inner group re-centres it and the outer group
  // is then free to be positioned purely from the DOM rect.
  useLayoutEffect(() => {
    const group = inner.current
    if (!group) return

    group.position.set(0, 0, 0)
    const box = new THREE.Box3().setFromObject(group)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    bounds.current = { size, center }
    group.position.copy(center).multiplyScalar(-1)
  }, [])

  useFrame((state, delta) => {
    const group = outer.current
    const measured = bounds.current
    if (!group || !measured || measured.size.x === 0) return

    const rect = getTargetRect(HERO_TARGET_ID)
    const { viewportHeight } = getScrollSnapshot()
    const height = viewportHeight || state.size.height

    if (!rect || !isRectVisible(rect, height, 400)) {
      group.visible = false
      return
    }

    group.visible = true

    const seat = rectToWorld(
      rect,
      camera as THREE.PerspectiveCamera,
      state.size.width,
      height,
    )

    // Contain, not cover: fit inside the box on both axes so the word is never
    // distorted or clipped by a rect whose aspect differs from the model's.
    const boxWidth = rect.width * seat.unitsPerPixel
    const boxHeight = rect.height * seat.unitsPerPixel
    const fit = Math.min(boxWidth / measured.size.x, boxHeight / measured.size.y)
    group.scale.setScalar(fit)

    if (reduced.current) {
      // Reduced motion gets the seat and nothing else, so the model sits
      // exactly on its rect.
      group.position.set(seat.x, seat.y, 0)
      group.rotation.set(0, 0, 0)
      return
    }

    const t = state.clock.elapsedTime
    const float = Math.sin(t * 0.6) * boxHeight * FLOAT_AMPLITUDE

    group.position.set(seat.x, seat.y + float, 0)

    // Pointer parallax. The PointerBus has already eased and recentred the
    // reading, so this only has to map it onto the model.
    const targetY = pointer.cx * TILT_Y
    const targetX = pointer.cy * TILT_X
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetY, 5, delta)
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, targetX, 5, delta)
  })

  return (
    <group ref={outer} visible={false}>
      <group ref={inner}>
        <Hello />
      </group>
    </group>
  )
}
