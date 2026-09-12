'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { GLTF } from 'three-stdlib'
import { canRenderGlass, getCapabilities } from '@/lib/capabilities'
import {
  applyFlatArrowDefinition,
  ARROW_REST_ATTITUDE,
  computeArrowSpinAxis,
} from './arrow-attitude'
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

/**
 * Turns the arrow makes across the hero's exit.
 *
 * The word makes about half of one. The arrow is a fraction of its size and
 * reads as an accent rather than as the subject, so it can afford to be the
 * fast-moving part of the same gesture — a small thing spinning several times
 * while a large one turns once is the whole reason to have both.
 */
const EXIT_TURNS = 4.5

export function HeroArrow() {
  const outer = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  /** The damped pointer lean, kept apart from the scroll-driven spin. */
  const leanRef = useRef({ x: 0, y: 0 })
  /** Scratch quaternions — rebuilt every frame, so never memo results. */
  const spinQuat = useRef(new THREE.Quaternion())
  const leanQuat = useRef(new THREE.Quaternion())
  const leanEuler = useRef(new THREE.Euler())
  const camera = useThree((state) => state.camera)

  const { nodes } = useGLTF('/models/arrow.glb') as unknown as ArrowGLTF
  const geometry = nodes.g_groupNumber_0_n3d.geometry

  const uniforms = useMemo(() => {
    const created = createGlassUniforms()
    // It starts face-on, which is the orientation the glass has least to work
    // with — see the note in arrow-attitude.
    applyFlatArrowDefinition(created)
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

  /** The arrow's own axis of symmetry — see computeArrowSpinAxis. */
  const spinAxis = useMemo(() => computeArrowSpinAxis(geometry), [geometry])

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

    // Flat at rest, then several whole turns as the hero leaves.
    //
    // Written straight rather than damped: it is a function of scroll, and
    // damping a scroll-driven angle makes it lag the page on a fast flick and
    // then catch up afterwards, which reads as the arrow being dragged rather
    // than turned. The pointer lean is damped, because that one IS chasing.
    const spin = progress * EXIT_TURNS * Math.PI * 2
    leanRef.current.x = THREE.MathUtils.damp(leanRef.current.x, pointer.cy * 0.3, 5, delta)
    leanRef.current.y = THREE.MathUtils.damp(leanRef.current.y, pointer.cx * 0.5, 5, delta)

    // Spin about the arrow's own axis, lean on top of it. Composed as
    // quaternions rather than set as Euler angles because the spin axis is a
    // diagonal in the screen plane, which no ordering of x/y/z rotations
    // expresses without the two gestures interfering.
    spinQuat.current.setFromAxisAngle(spinAxis, spin)
    leanEuler.current.set(leanRef.current.x, leanRef.current.y, 0)
    leanQuat.current.setFromEuler(leanEuler.current)
    group.quaternion.copy(leanQuat.current).multiply(spinQuat.current)

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
      {/* Fixed: squares the plate up to the camera, so the spin above starts
          from flat rather than from the diagonal the model was authored on. */}
      <group quaternion={ARROW_REST_ATTITUDE}>
        <group position={[-measured.center.x, -measured.center.y, -measured.center.z]}>
          <mesh ref={meshRef} geometry={geometry} position={BAKED_POSITION} scale={BAKED_SCALE}>
            <shaderMaterial
              vertexShader={glassVertexShader}
              fragmentShader={glassFragmentShader}
              uniforms={uniforms}
              // Face-on and several turns per exit: a back-face cull blinks it
              // out every half turn.
              side={THREE.DoubleSide}
              transparent
            />
          </mesh>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/arrow.glb')
