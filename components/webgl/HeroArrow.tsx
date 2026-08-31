'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { GLTF } from 'three-stdlib'
import { canRenderGlass, getCapabilities } from '@/lib/capabilities'
import { getHeroObjectDissolve, getHeroProgress } from '@/lib/hero-progress'
import { pointer } from '@/lib/pointer-bus'
import { getTargetRect } from '@/lib/rect-sampler'
import { isSurfaceDark } from '@/lib/surface'
import { glassFragmentShader, glassVertexShader } from '@/shaders/glass'
import { glassPasses } from './glass-passes'
import { FIELD_TARGET_ID } from './HeroField'
import { createGlassUniforms } from './HeroHello'
import { LAYER_GLASS } from './layers'
import { rectToWorld } from './rect-space'

/**
 * The glass arrow — the hero's second object, and the one that makes the word
 * read as part of a set rather than as the only thing on the stage.
 *
 * Same material as the word, so it picks up the same refraction, dispersion,
 * rim light and scroll dissolve for free; on the same layer, so the refraction
 * pass excludes it and the flare finds its highlights. Small, and parked in the
 * lower right where it does not compete with the headline.
 */

type ArrowGLTF = GLTF & { nodes: { g_groupNumber_0_n3d: THREE.Mesh } }

/** The GLB's baked transform, kept so the geometry sits where it was authored. */
const BAKED_POSITION: [number, number, number] = [-5.549, 2.201, -2.095]
const BAKED_SCALE = 1.534

/** Where it sits in the hero, as a fraction of the section. */
const ANCHOR_X = 0.82
const ANCHOR_Y = 0.72

/** Its height as a fraction of the section's — deliberately a small accent. */
const RELATIVE_HEIGHT = 0.12

export function HeroArrow() {
  const outer = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const camera = useThree((state) => state.camera)

  const { nodes } = useGLTF('/models/arrow.glb') as unknown as ArrowGLTF
  const geometry = nodes.g_groupNumber_0_n3d.geometry

  const uniforms = useMemo(() => {
    const created = createGlassUniforms()
    // Reads at a fraction of the word's size, so it needs less body to carry
    // the same colour and a tighter highlight to stay crisp.
    created.uThickness.value = 0.9
    created.uRimStrength.value = 0.9
    return created
  }, [])

  /** Bounds from the geometry and its baked transform — never Box3 on the
   *  mounted object, which measures in world space and folds in the scale this
   *  component has already applied. */
  const measured = useMemo(() => {
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!.clone()
    box.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...BAKED_POSITION),
        new THREE.Quaternion(),
        new THREE.Vector3(BAKED_SCALE, BAKED_SCALE, BAKED_SCALE),
      ),
    )
    const raw = geometry.boundingBox!
    return {
      size: box.getSize(new THREE.Vector3()),
      center: box.getCenter(new THREE.Vector3()),
      localY: new THREE.Vector2(raw.min.y, raw.max.y),
    }
  }, [geometry])

  useEffect(() => {
    meshRef.current?.layers.set(LAYER_GLASS)
  }, [])

  useFrame((state, delta) => {
    const group = outer.current
    const mesh = meshRef.current
    if (!group || !mesh || measured.size.y === 0) return

    const rect = getTargetRect(FIELD_TARGET_ID)
    const progress = getHeroProgress()
    if (!rect || !rect.valid || !canRenderGlass(getCapabilities()) || progress >= 1) {
      group.visible = false
      return
    }
    group.visible = true

    const perspective = camera as THREE.PerspectiveCamera
    const seat = rectToWorld(rect, perspective, state.size.width, state.size.height)
    const sectionHeight = rect.height * seat.unitsPerPixel
    const sectionWidth = rect.width * seat.unitsPerPixel

    const fit = (sectionHeight * RELATIVE_HEIGHT) / measured.size.y
    group.scale.setScalar(fit * (1 - 0.5 * progress))

    const float = Math.sin(state.clock.elapsedTime * 0.7) * sectionHeight * 0.012
    group.position.set(
      seat.x + (ANCHOR_X - 0.5) * sectionWidth,
      seat.y - (ANCHOR_Y - 0.5) * sectionHeight + float,
      0,
    )

    // Leans toward the pointer, and turns as the hero leaves — the same two
    // gestures the word makes, at a smaller amplitude.
    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      pointer.cx * 0.5 + progress * 1.6,
      5,
      delta,
    )
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, pointer.cy * 0.3, 5, delta)
    group.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.08

    const material = mesh.material as THREE.ShaderMaterial
    material.uniforms.uSceneTexture.value = glassPasses.refraction?.texture ?? null
    material.uniforms.uLocalYRange.value.copy(measured.localY)
    material.uniforms.uResolution.value.set(
      state.size.width * state.viewport.dpr,
      state.size.height * state.viewport.dpr,
    )
    material.uniforms.uDark.value = isSurfaceDark() ? 1 : 0
    material.uniforms.uPixelRatio.value = state.viewport.dpr
    material.uniforms.uDissolve.value = getHeroObjectDissolve()
  })

  return (
    <group ref={outer} visible={false}>
      <group position={[-measured.center.x, -measured.center.y, -measured.center.z]}>
        <mesh ref={meshRef} geometry={geometry} position={BAKED_POSITION} scale={BAKED_SCALE}>
          <shaderMaterial
            vertexShader={glassVertexShader}
            fragmentShader={glassFragmentShader}
            uniforms={uniforms}
            transparent
          />
        </mesh>
      </group>
    </group>
  )
}

useGLTF.preload('/models/arrow.glb')
