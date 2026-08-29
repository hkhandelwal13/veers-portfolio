'use client'

import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Hello } from './Hello'
import { scrollState } from '@/lib/scroll-store'
import { prefersReducedMotion } from '@/lib/lenis'

/** Fraction of the viewport width the word should span. */
const TARGET_WIDTH = 0.66
/** How far the word travels up over one screen of scroll, in world units.
 *  Enough to clear the frame, so it doesn't peek out behind later sections. */
const SCROLL_TRAVEL = 2.4

/**
 * Hero placeholder for the "hello" model (CLAUDE.md §6 — locked as the hero,
 * geometry kept as-is).
 *
 * The GLB carries a baked, off-origin transform (position ~[8, 3, -62],
 * scale 8), so rather than hard-coding magic numbers we measure its bounds once
 * and normalise: recentre on the origin, then scale so the word spans a fixed
 * fraction of the viewport at any breakpoint.
 *
 * Motion is imperative — refs mutated in useFrame, no React state per frame.
 * The material is still the model's baked `water_material3`; swapping it for
 * MeshTransmissionMaterial / custom GLSL glass is Phase 4.
 */
export function HeroHello() {
  const outer = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const bounds = useRef<{ size: THREE.Vector3; center: THREE.Vector3 } | null>(null)
  const reduced = useRef(false)

  const viewportWidth = useThree((s) => s.viewport.width)

  useLayoutEffect(() => {
    reduced.current = prefersReducedMotion()
  }, [])

  // Measure once — the geometry never changes.
  useLayoutEffect(() => {
    const group = inner.current
    if (!group) return
    group.position.set(0, 0, 0)
    const box = new THREE.Box3().setFromObject(group)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    bounds.current = { size, center }
    // Recentre the baked offset onto the origin.
    group.position.copy(center).multiplyScalar(-1)
  }, [])

  // Re-fit whenever the viewport changes.
  useLayoutEffect(() => {
    const group = outer.current
    const b = bounds.current
    if (!group || !b || b.size.x === 0) return
    group.scale.setScalar((viewportWidth * TARGET_WIDTH) / b.size.x)
  }, [viewportWidth])

  useFrame((state, delta) => {
    const group = outer.current
    if (!group) return

    // 0..1 through the first screenful — the hero's own scroll progress.
    const p = THREE.MathUtils.clamp(scrollState.y / Math.max(state.size.height, 1), 0, 1)

    if (reduced.current) {
      group.position.set(0, 0, 0)
      group.rotation.set(0, 0, 0)
      return
    }

    const t = state.clock.elapsedTime

    // Idle float, plus a lift as the hero scrolls away. +Y is up in three.js,
    // so the word rises out of frame with the page rather than sinking.
    group.position.y = Math.sin(t * 0.6) * 0.06 + p * SCROLL_TRAVEL
    group.position.x = Math.sin(t * 0.4) * 0.03

    // Pointer parallax, eased toward the target so it never snaps.
    const targetY = state.pointer.x * 0.28 + p * 0.35
    const targetX = -state.pointer.y * 0.16 + p * 0.25
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetY, 4, delta)
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, targetX, 0.06)

    // Scroll velocity adds a little bank — the word leans into the motion.
    group.rotation.z = THREE.MathUtils.lerp(
      group.rotation.z,
      THREE.MathUtils.clamp(scrollState.velocity * 0.004, -0.18, 0.18),
      0.08,
    )
  })

  return (
    <group ref={outer}>
      <group ref={inner}>
        <Hello />
      </group>
    </group>
  )
}
