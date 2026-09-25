'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { canRenderStarFlare, getCapabilities } from '@/lib/capabilities'
import { getHeroObjectDissolve } from '@/lib/hero-progress'
import { fullscreenVertexShader, starCompositeFragmentShader } from '@/shaders/star6'
import { glassPasses } from './glass-passes'
import { LAYER_OVERLAY } from './layers'

/**
 * Composites the six-ray streaks over the finished frame.
 *
 * RefractionPass computed them into a half-resolution target; this is just the
 * additive draw, which is why it can run every frame while the streaks
 * themselves update on alternate ones.
 *
 * It lives on the overlay layer so the refraction pass — which renders content
 * only — cannot pick it up, which would feed the flare back into the glass that
 * produced it.
 */
export function StarFlare() {
  const meshRef = useRef<THREE.Mesh>(null)

  const uniforms = useMemo(
    () => ({
      uStar: { value: null as THREE.Texture | null },
      uOpacity: { value: 0.85 },
    }),
    [],
  )

  useLayoutEffect(() => {
    meshRef.current?.layers.set(LAYER_OVERLAY)
  }, [])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const star = glassPasses.star
    const material = mesh.material as THREE.ShaderMaterial

    // Nothing to composite while the glass is offscreen or the effect is gated
    // off — and the streak target is stale then anyway.
    // Also off once the word starts dissolving. The pass that fills this target
    // stops there (see RefractionPass), and compositing a stale buffer leaves a
    // white haze frozen over the hero for the rest of the scroll.
    if (
      !star ||
      !glassPasses.glassVisible ||
      getHeroObjectDissolve() > 0.02 ||
      !canRenderStarFlare(getCapabilities())
    ) {
      mesh.visible = false
      return
    }

    mesh.visible = true
    material.uniforms.uStar.value = star.texture
  })

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={10} visible={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={fullscreenVertexShader}
        fragmentShader={starCompositeFragmentShader}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        // Adds light without touching the destination alpha. Plain additive
        // blending adds alpha too, and on a transparent canvas composited over
        // a CSS background that makes the near-black areas of the flare buffer
        // become *visible* — the effect reads as dark speckle rather than glow.
        blending={THREE.CustomBlending}
        blendEquation={THREE.AddEquation}
        blendSrc={THREE.SrcAlphaFactor}
        blendDst={THREE.OneFactor}
        blendEquationAlpha={THREE.AddEquation}
        blendSrcAlpha={THREE.ZeroFactor}
        blendDstAlpha={THREE.OneFactor}
      />
    </mesh>
  )
}
