'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { getCapabilities } from '@/lib/capabilities'
import {
  getFinaleProgress,
  getRayDensity,
  getRingPhase,
  getRoomDarkness,
  isFinaleVisible,
} from '@/lib/finale-progress'
import { warpFragmentShader, warpVertexShader } from '@/shaders/warp'

/**
 * The hyperspace tunnel behind the finale's arrow.
 *
 * One fullscreen quad, drawn additively on the content layer. Content, not
 * overlay, because the refraction pass renders that layer into the target the
 * glass samples — which is what lets the arrow bend the rays while it is still
 * an object and then break up and hand them over directly.
 *
 * Left on the default layer, which IS the content layer.
 *
 * Its uniforms are written at priority -2.5: after the rect sampler at -3, so
 * the scroll it reads is this frame's, and before the refraction pass at -2, so
 * the target the glass refracts is this frame's field rather than the last
 * one's. Anything at the default priority would be a frame behind inside the
 * arrow and correct outside it, which shows up as the rays sliding against
 * themselves at the silhouette's edge.
 */
export function FinaleWarp() {
  const meshRef = useRef<THREE.Mesh>(null)

  const initialUniforms = useMemo(
    () => ({
      uDensity: { value: 0 },
      uRingPhase: { value: 0 },
      uRoom: { value: 0 },
      uFine: { value: 1 },
      uAspect: { value: 1 },
      // Not a token: the room is the same black in both themes. In the dark
      // one it lands on the black the work grid already handed over and
      // changes nothing; in the light one it is the whole point.
      uRoomColor: { value: new THREE.Color('#000000') },
      // The ray ramp, cool to hot — cyan through blue into violet.
      uRayCool: { value: new THREE.Color('#3ee8ff') },
      uRayMid: { value: new THREE.Color('#3a6bff') },
      uRayHot: { value: new THREE.Color('#c05cff') },
      uRingColor: { value: new THREE.Color('#b8e614') },
    }),
    [],
  )

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return

    // Deliberately not gated on canRenderGlass, unlike everything else in the
    // finale. That gate is about the second scene render the refraction costs;
    // this is one quad, and it is the only thing that makes the section a dark
    // room — without it a small screen in the light theme gets white copy on
    // white paper for five viewports. The fine layers are dropped there
    // instead, which is where the cost actually is.
    if (!isFinaleVisible()) {
      mesh.visible = false
      return
    }

    const t = getFinaleProgress()
    const density = getRayDensity(t)
    const rings = getRingPhase(t)
    const room = getRoomDarkness(t)

    if (density <= 0.001 && rings <= 0 && room <= 0.001) {
      mesh.visible = false
      return
    }
    mesh.visible = true

    const uniforms = (mesh.material as THREE.ShaderMaterial).uniforms
    uniforms.uDensity.value = density
    uniforms.uRingPhase.value = rings
    uniforms.uRoom.value = room
    uniforms.uFine.value = getCapabilities().compact ? 0 : 1
    uniforms.uAspect.value = state.size.width / Math.max(state.size.height, 1)
  }, -2.5)

  return (
    <mesh
      ref={meshRef}
      // The quad ignores the camera, so frustum culling would be meaningless.
      frustumCulled={false}
      renderOrder={-2}
      visible={false}
    >
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={warpVertexShader}
        fragmentShader={warpFragmentShader}
        uniforms={initialUniforms}
        transparent
        // Premultiplied normal blending, which is additive wherever the room's
        // alpha is zero — see the note at the end of the fragment shader.
        premultipliedAlpha
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}
