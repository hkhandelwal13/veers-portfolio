'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  canRenderCursor,
  canRenderGlass,
  getCapabilities,
} from '@/lib/capabilities'
import { getHeroProgress } from '@/lib/hero-progress'
import { pointer, pointerRaw } from '@/lib/pointer-bus'
import { getTargetRect } from '@/lib/rect-sampler'
import { isSurfaceDark } from '@/lib/surface'
import { glassFragmentShader, glassVertexShader } from '@/shaders/glass'
import { glassPasses } from './glass-passes'
import { createGlassUniforms } from './HeroHello'
import { FIELD_TARGET_ID } from './HeroField'
import { LAYER_LENS } from './layers'

/**
 * The cursor, as a bead of liquid glass.
 *
 * This is where the fluid distortion lives. Everything under the pointer bends
 * — the word, the stickers, the ground — because the lens refracts a render of
 * the scene *including* the word, rather than because any of those things are
 * themselves wobbling. That distinction is the whole effect: the page is still,
 * and the thing you are moving is a piece of glass.
 *
 * A subdivided icosahedron rather than a sphere: the facets give the refraction
 * a surface with structure to bend across, which is what stops it looking like
 * a smooth magnifying bubble. It morphs slowly on its own axis so the highlight
 * travels even when the pointer is at rest.
 *
 * Sits on its own layer so the pass that feeds it can exclude it — a lens that
 * refracts a picture of itself feeds back into a smear within a few frames.
 */

/** Radius in world units at the depth it sits — roughly a 45px bead. */
const RADIUS = 0.19

/** How hard it chases the pointer. Lower lags more. */
const FOLLOW_LAMBDA = 13

export function CursorLens() {
  const meshRef = useRef<THREE.Mesh>(null)
  const positionRef = useRef(new THREE.Vector3())
  const uniforms = useMemo(() => {
    const created = createGlassUniforms()
    // Much clearer than the word: this is a lens, not a coloured object.
    //
    // Refraction strength is a *screen UV* offset, so it does not scale with
    // the object — at 0.42 a small bead pushed every sample nearly half a
    // screen away, hit the sampler's clamp, and came back as a flat disc of
    // whatever colour the frame's edge happened to be.
    created.uTintAmount.value = 0.05
    created.uRefractStrength.value = 0.2
    created.uDispersion.value = 0.095
    created.uIor.value = 1.34
    // Thin: thickness drives the tint's depth, and a bead that absorbs like the
    // word does comes out as a dark marble rather than as a piece of glass.
    created.uThickness.value = 0.28
    // A thinner Fresnel ring: the wide one the word uses reads as a dark
    // rim all the way round a bead this small, which is what makes it look
    // like a marble instead of a drop.
    created.uRimPower.value = 3.6
    created.uRimStrength.value = 1.15
    created.uSpecStrength.value = 1.5
    created.uLocalYRange.value.set(-RADIUS, RADIUS)
    return created
  }, [])

  useEffect(() => {
    meshRef.current?.layers.set(LAYER_LENS)
    return () => {
      glassPasses.lensVisible = false
    }
  }, [])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const caps = getCapabilities()
    // Needs a real pointer to be, and the offscreen pass that feeds it.
    const rect = getTargetRect(FIELD_TARGET_ID)
    const active =
      canRenderCursor(caps) &&
      canRenderGlass(caps) &&
      pointer.inside &&
      !!rect?.valid &&
      getHeroProgress() < 0.9

    glassPasses.lensVisible = active
    mesh.visible = active
    if (!active) return

    // The pointer's true position, not the eased one: the bus's easing is tuned
    // for parallax, and a lens that lags that far behind the cursor stops
    // reading as attached to it.
    const camera = state.camera as THREE.PerspectiveCamera
    const viewHeight = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360)
    const target = positionRef.current
    const targetX = (pointerRaw.x - 0.5) * viewHeight * camera.aspect
    const targetY = -(pointerRaw.y - 0.5) * viewHeight

    const lambda = 1 - Math.exp(-FOLLOW_LAMBDA * Math.min(Math.max(delta, 0), 0.1))
    target.x += (targetX - target.x) * lambda
    target.y += (targetY - target.y) * lambda
    mesh.position.set(target.x, target.y, 0.6)

    // A slow tumble so the specular keeps moving on a stationary pointer, and a
    // stretch along the direction of travel — the shape a drop takes when it is
    // dragged.
    const time = state.clock.elapsedTime
    mesh.rotation.set(time * 0.35, time * 0.47, 0)

    const dx = targetX - target.x
    const dy = targetY - target.y
    const stretch = Math.min(Math.hypot(dx, dy) * 0.9, 0.45)
    const angle = Math.atan2(dy, dx)
    mesh.scale.set(1 + stretch, 1 - stretch * 0.5, 1)
    mesh.rotation.z = angle

    const material = mesh.material as THREE.ShaderMaterial
    material.uniforms.uSceneTexture.value = glassPasses.lensScene?.texture ?? null
    material.uniforms.uResolution.value.set(
      state.size.width * state.viewport.dpr,
      state.size.height * state.viewport.dpr,
    )
    material.uniforms.uDark.value = isSurfaceDark() ? 1 : 0
    material.uniforms.uPixelRatio.value = state.viewport.dpr
  })

  return (
    <mesh ref={meshRef} visible={false} frustumCulled={false} renderOrder={10}>
      <icosahedronGeometry args={[RADIUS, 6]} />
      <shaderMaterial
        vertexShader={glassVertexShader}
        fragmentShader={glassFragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  )
}
