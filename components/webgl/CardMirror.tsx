'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { getTargetRect } from '@/lib/rect-sampler'
import { getScrollSnapshot } from '@/lib/scroll-bus'
import { getHoverIntent } from '@/lib/hover-bus'
import { canAnimateCardReveal, getCapabilities } from '@/lib/capabilities'
import { domSyncFragmentShader, domSyncVertexShader } from '@/shaders/dom-sync'
import { getPlaceholderPosterTexture, getPlaceholderRevealTexture } from './placeholder-poster'
import { isRectVisible, rectToUniform } from './rect-space'

/** Dot-matrix cell size in CSS px. */
const CELL_PX = 14
/**
 * Seconds for the wavefront to cross the card.
 *
 * Deliberately a constant-speed sweep rather than exponential damping: damping
 * front-loads the motion and then crawls, so the squares appear to pop near the
 * centre and the growth — the thing worth watching — is over before the eye
 * catches it. Roughly matches --dur-med so the WebGL reveal and the DOM
 * metadata scrim land together.
 */
const REVEAL_SECONDS = 0.45

function createUniforms() {
  return {
    uMap: { value: getPlaceholderPosterTexture() },
    uMapReveal: { value: getPlaceholderRevealTexture() },
    uRect: { value: new THREE.Vector4(0, 0, 0, 0) },
    uOpacity: { value: 1 },
    uRevealProgress: { value: 0 },
    uCellPx: { value: CELL_PX },
    uViewportPx: { value: new THREE.Vector2(1, 1) },
  }
}

/**
 * One fullscreen mesh mirroring one DOM card image, with the dot-matrix hover
 * reveal (PHASE4_KICKOFF item 1).
 *
 * A fullscreen quad per card is deliberate — it keeps the coordinate math to a
 * single uniform (see shaders/dom-sync.ts) instead of moving geometry around.
 * The cost is overdraw, which is why anything far outside the viewport stops
 * being drawn at all.
 *
 * Per-frame values are written straight onto the material's own uniforms,
 * reached through the mesh ref. That keeps three.js as the owner of this state
 * rather than a React-held object that merely shares its reference — which is
 * also what keeps it clear of React's immutability rules.
 *
 * Shutoffs, all present from the start:
 *   offscreen       the mesh is hidden and its progress reset, so a card that
 *                   scrolls away and comes back replays from the beginning
 *   no hover        touch devices hold the poster; a tap should follow the
 *                   link, not start an animation
 *   reduced motion  the reveal still happens — the second image is content —
 *                   but snaps rather than sweeping
 */
export function CardMirror({ targetId }: { targetId: string }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const progress = useRef(0)

  const initialUniforms = useMemo(() => createUniforms(), [])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const material = mesh.material as THREE.ShaderMaterial
    const uniforms = material.uniforms

    const rect = getTargetRect(targetId)
    const { viewportHeight } = getScrollSnapshot()
    const height = viewportHeight || state.size.height

    // Hide when the texture isn't ready, the rect is invalid, or the card is
    // far offscreen — a fullscreen quad is too expensive to draw for nothing.
    if (!uniforms.uMap.value || !rect || !isRectVisible(rect, height)) {
      mesh.visible = false
      // Reset offscreen so the reveal replays on the card's next visit.
      progress.current = 0
      uniforms.uRevealProgress.value = 0
      return
    }

    mesh.visible = true
    rectToUniform(rect, state.size.width, height, uniforms.uRect.value)
    uniforms.uViewportPx.value.set(state.size.width, height)

    const caps = getCapabilities()
    const target = canAnimateCardReveal(caps) ? getHoverIntent(targetId) : 0

    if (caps.reducedMotion) {
      progress.current = target
    } else {
      // Constant rate, so the wavefront crosses the card at a steady speed and
      // arrives exactly — no asymptote left hanging at 0.999...
      const step = (delta / REVEAL_SECONDS) * Math.sign(target - progress.current)
      progress.current =
        Math.abs(target - progress.current) <= Math.abs(step)
          ? target
          : THREE.MathUtils.clamp(progress.current + step, 0, 1)
    }

    uniforms.uRevealProgress.value = progress.current
  })

  return (
    <mesh
      ref={meshRef}
      // The quad ignores the camera, so frustum culling would be meaningless
      // and occasionally wrong.
      frustumCulled={false}
      renderOrder={-1}
      visible={false}
    >
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={domSyncVertexShader}
        fragmentShader={domSyncFragmentShader}
        uniforms={initialUniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}
