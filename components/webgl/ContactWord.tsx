'use client'

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { GLTF } from 'three-stdlib'
import {
  canRenderGlass,
  getCapabilities,
  getServerCapabilities,
  subscribeToCapabilities,
} from '@/lib/capabilities'
import { pointer } from '@/lib/pointer-bus'
import { getTargetRect } from '@/lib/rect-sampler'
import { getScrollSnapshot } from '@/lib/scroll-bus'
import { createRingLight } from '@/lib/ring-light'
import { isSurfaceDark } from '@/lib/surface'
import { getServerTheme, getTheme, subscribeToTheme } from '@/lib/theme'
import { glassFragmentShader, glassVertexShader } from '@/shaders/glass'
import { glassPasses } from './glass-passes'
import { createGlassUniforms } from './HeroHello'
import { LAYER_GLASS } from './layers'
import { isRectVisible, rectToWorld } from './rect-space'

/**
 * The closing word, in the same glass as the hero's.
 *
 * Deliberately the hero's treatment repeated rather than a variation on it:
 * the page opens on a glass word over a blue field with stickers falling
 * through it and closes the same way, and the repeat is what makes the middle
 * read as a passage between two of the same place.
 *
 * Two differences. Nothing here dissolves — the hero's word is something you
 * scroll past, this one is where you stop. And it stands up as you arrive:
 * flat on its back before the section is up, square to the camera once it is,
 * which is the closing screen's answer to the finale's arrow going the other
 * way.
 */

type ContactGLTF = GLTF & { nodes: { g_groupNumber_0_n3d: THREE.Mesh } }

export const CONTACT_TARGET_ID = 'wordmark'

/** The GLB's baked transform, kept so the geometry sits where it was authored. */
const BAKED_POSITION: [number, number, number] = [0.157, 1.782, 0.18]
const BAKED_SCALE = 2.199

/** Grows past its reserved rect, as the hero's word does. */
const FILL = 1.22
const FLOAT_AMPLITUDE = 0.02
const TILT_X = 0.1
const TILT_Y = 0.16

/** Lying flat, face to the ceiling — where the word starts before it stands. */
const LAID_FLAT = -Math.PI / 2

export function ContactWord() {
  const outer = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const ringLight = useRef<ReturnType<typeof createRingLight> | null>(null)

  const camera = useThree((state) => state.camera)
  const { nodes } = useGLTF('/models/contact.glb') as unknown as ContactGLTF
  const geometry = nodes.g_groupNumber_0_n3d.geometry

  const initialUniforms = useMemo(() => createGlassUniforms(), [])

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
    ringLight.current = createRingLight(1)
  }, [])

  useFrame((state, delta) => {
    const group = outer.current
    const mesh = meshRef.current
    if (!group || !mesh || measured.size.x === 0) return

    const rect = getTargetRect(CONTACT_TARGET_ID)
    const { viewportHeight } = getScrollSnapshot()
    const height = viewportHeight || state.size.height

    if (!rect || !isRectVisible(rect, height, 400)) {
      group.visible = false
      return
    }
    group.visible = true

    const seat = rectToWorld(rect, camera as THREE.PerspectiveCamera, state.size.width, height)
    const boxWidth = rect.width * seat.unitsPerPixel
    const boxHeight = rect.height * seat.unitsPerPixel
    const fit = Math.min(boxWidth / measured.size.x, boxHeight / measured.size.y)
    group.scale.setScalar(fit * FILL)

    const caps = getCapabilities()
    const material = mesh.material as THREE.ShaderMaterial
    const uniforms = material.uniforms

    // Absent on the small-screen fallback, which uses a standard material.
    if (uniforms && uniforms.uSceneTexture) {
      uniforms.uLocalYRange.value.copy(measured.localY)
      uniforms.uSceneTexture.value = glassPasses.refraction?.texture ?? null
      uniforms.uResolution.value.set(
        state.size.width * state.viewport.dpr,
        state.size.height * state.viewport.dpr,
      )
      uniforms.uDark.value = isSurfaceDark() ? 1 : 0
      uniforms.uPixelRatio.value = state.viewport.dpr

      const ring = caps.reducedMotion
        ? ringLight.current?.update(0, 0, false, delta)
        : ringLight.current?.update(pointer.cx, pointer.cy, pointer.inside, delta)
      if (ring) uniforms.uLightDirection.value.set(ring.x, ring.y, 0.6)
    }

    if (caps.reducedMotion) {
      group.position.set(seat.x, seat.y, 0)
      group.rotation.set(0, 0, 0)
      return
    }

    // Standing up, scrubbed rather than played: 1 while the slot is still low
    // on the screen, 0 once it has risen into place. A timed entrance would
    // fire once and then be wrong for anyone who scrolled back.
    const laid = THREE.MathUtils.clamp((rect.y - height * 0.2) / (height * 0.5), 0, 1)

    const float = Math.sin(state.clock.elapsedTime * 0.6) * boxHeight * FLOAT_AMPLITUDE
    group.position.set(seat.x, seat.y + float, 0)
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, pointer.cx * TILT_Y, 5, delta)
    // The tilt is damped toward its target; the entrance is not, because it is
    // a function of scroll and damping it would let it lag a fast one.
    group.rotation.x =
      THREE.MathUtils.damp(group.rotation.x - LAID_FLAT * laid, pointer.cy * TILT_X, 5, delta) +
      LAID_FLAT * laid
  })

  const caps = useSyncExternalStore(
    subscribeToCapabilities,
    getCapabilities,
    getServerCapabilities,
  )
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, getServerTheme)

  return (
    <group ref={outer} visible={false}>
      <group position={[-measured.center.x, -measured.center.y, -measured.center.z]}>
        <mesh ref={meshRef} geometry={geometry} position={BAKED_POSITION} scale={BAKED_SCALE}>
          {canRenderGlass(caps) ? (
            <shaderMaterial
              vertexShader={glassVertexShader}
              fragmentShader={glassFragmentShader}
              uniforms={initialUniforms}
              transparent
            />
          ) : (
            <meshStandardMaterial
              color={theme === 'dark' ? '#4E76D0' : '#8EBFE8'}
              roughness={0.25}
              metalness={0.1}
            />
          )}
        </mesh>
      </group>
    </group>
  )
}

useGLTF.preload('/models/contact.glb')
