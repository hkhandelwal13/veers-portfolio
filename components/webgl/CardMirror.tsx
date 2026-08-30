'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { getTargetRect } from '@/lib/rect-sampler'
import { getScrollSnapshot } from '@/lib/scroll-bus'
import { domSyncFragmentShader, domSyncVertexShader } from '@/shaders/dom-sync'
import { getPlaceholderPosterTexture } from './placeholder-poster'
import { isRectVisible, rectToUniform } from './rect-space'

/**
 * One fullscreen mesh mirroring one DOM card image.
 *
 * A fullscreen quad per card is deliberate — it keeps the coordinate math to a
 * single uniform (see shaders/dom-sync.ts) instead of moving geometry around.
 * The cost is overdraw, which is why anything far outside the viewport stops
 * being drawn at all.
 */
export function CardMirror({ targetId }: { targetId: string }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useMemo(() => getPlaceholderPosterTexture(), [])

  const uniforms = useMemo(
    () => ({
      uMap: { value: texture },
      uRect: { value: new THREE.Vector4(0, 0, 0, 0) },
      uOpacity: { value: 1 },
    }),
    [texture],
  )

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return

    const rect = getTargetRect(targetId)
    const { viewportHeight } = getScrollSnapshot()
    const height = viewportHeight || state.size.height

    // Hide when the texture isn't ready, the rect is invalid, or the card is
    // far offscreen — a fullscreen quad is too expensive to draw for nothing.
    if (!texture || !rect || !isRectVisible(rect, height)) {
      mesh.visible = false
      return
    }

    mesh.visible = true
    rectToUniform(rect, state.size.width, height, uniforms.uRect.value)
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
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}
