'use client'

import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { GLTF } from 'three-stdlib'
import { getTargetRect } from '@/lib/rect-sampler'
import { getScrollSnapshot } from '@/lib/scroll-bus'
import { pointer } from '@/lib/pointer-bus'
import {
  canRenderGlass,
  getCapabilities,
  getServerCapabilities,
  subscribeToCapabilities,
} from '@/lib/capabilities'
import { createRingLight } from '@/lib/ring-light'
import { isSurfaceDark } from '@/lib/surface'
import { glassFragmentShader, glassVertexShader } from '@/shaders/glass'
import { glassPasses } from './glass-passes'
import { LAYER_GLASS } from './layers'
import { isRectVisible, rectToWorld } from './rect-space'

export const HERO_TARGET_ID = 'hero-hello'

/** Idle float, as a fraction of the seated height — small enough to read as breathing. */
const FLOAT_AMPLITUDE = 0.02
/** Pointer parallax, in radians. */
const TILT_X = 0.1
const TILT_Y = 0.16

/** The GLB carries this baked transform; kept so the geometry sits where it was authored. */
const BAKED_POSITION: [number, number, number] = [8.158, 2.861, -62.453]
const BAKED_SCALE = 8.019

type HelloGLTF = GLTF & { nodes: { g_groupNumber_0_n3d: THREE.Mesh } }

function createGlassUniforms() {
  return {
    uSceneTexture: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uIor: { value: 1.18 },
    uDispersion: { value: 0.035 },
    uRefractStrength: { value: 0.16 },
    uThickness: { value: 1.1 },
    // BRAND_TOKENS: Sky Blue body, Ocean Blue for the dark variant.
    uTintLight: { value: new THREE.Color('#8EBFE8') },
    uTintDark: { value: new THREE.Color('#4E76D0') },
    // Blended in along the word's height. Ocean Blue deepens the lower strokes
    // while Sky Blue keeps the tops luminous.
    uTintSecondary: { value: new THREE.Color('#4E76D0') },
    uLocalYRange: { value: new THREE.Vector2(0, 1) },
    uTintAmount: { value: 0.8 },
    uDark: { value: 0 },
    uHighlightOnly: { value: 0 },
    uRimColor: { value: new THREE.Color('#FFF4DC') },
    uRimPower: { value: 2.6 },
    uRimStrength: { value: 0.7 },
    uLightDirection: { value: new THREE.Vector3(0.4, 0.9, 0.6) },
  }
}


/**
 * The glass `hello`, seated in its DOM-defined box.
 *
 * Seating (Phase 3): every frame it reads the rect measured for
 * `data-webgl="hero-hello"` and converts it to world space, so CSS keeps
 * deciding where the hero sits at every breakpoint and the 3D layer needs no
 * media queries. Because the rect sampler runs at useFrame priority -3 and the
 * ScrollBus was written before that, the rect read here matches the DOM this
 * very frame — which is what keeps the model glued during a fast scroll.
 *
 * Material (Phase 4 item 4): a screen-space refraction shader sampling the
 * scene-without-glass that RefractionPass rendered earlier in the frame. The
 * mesh sits on its own layer so those passes can include or exclude it.
 *
 * Falls back to an opaque material where the glass is gated off — the word is
 * the hero, so it renders either way.
 */
export function HeroHello() {
  const outer = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  // Holds the light's angle between frames, so it belongs in a ref rather than
  // a memo — a memo result is treated as immutable.
  const ringLight = useRef<ReturnType<typeof createRingLight> | null>(null)

  const camera = useThree((state) => state.camera)
  const { nodes } = useGLTF('/models/hello.glb') as unknown as HelloGLTF
  const geometry = nodes.g_groupNumber_0_n3d.geometry

  const initialUniforms = useMemo(() => createGlassUniforms(), [])


  /**
   * Bounds of the word, derived from the geometry and its baked transform.
   *
   * Deliberately NOT Box3.setFromObject on the mounted group: that measures in
   * world space, so it silently folds in whatever scale the parent happens to
   * be carrying at the moment it runs. Measure once on mount and it is right;
   * measure again after a frame has seated the model — which React does in
   * development, and which any remount does — and it returns the already-scaled
   * size, shrinking the word a little more each time.
   *
   * Deriving from the geometry makes the result independent of when it runs.
   */
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
      // Geometry-space Y range: the vertex shader sees `position` before the
      // mesh's own transform, so the gradient has to be normalised against the
      // raw bounds rather than the transformed ones.
      localY: new THREE.Vector2(raw.min.y, raw.max.y),
    }
  }, [geometry])

  // The passes select on layer, so the mesh has to be assigned before they run.
  useLayoutEffect(() => {
    meshRef.current?.layers.set(LAYER_GLASS)
    ringLight.current = createRingLight(1)
  }, [])

  useFrame((state, delta) => {
    const group = outer.current
    const mesh = meshRef.current
    if (!group || !mesh || measured.size.x === 0) return

    const rect = getTargetRect(HERO_TARGET_ID)
    const { viewportHeight } = getScrollSnapshot()
    const height = viewportHeight || state.size.height

    if (!rect || !isRectVisible(rect, height, 400)) {
      group.visible = false
      // Tells the flare pass it can stop entirely.
      glassPasses.glassVisible = false
      return
    }

    group.visible = true
    glassPasses.glassVisible = true

    const seat = rectToWorld(rect, camera as THREE.PerspectiveCamera, state.size.width, height)

    // Contain, not cover: fit inside the box on both axes so the word is never
    // distorted or clipped by a rect whose aspect differs from the model's.
    const boxWidth = rect.width * seat.unitsPerPixel
    const boxHeight = rect.height * seat.unitsPerPixel
    const fit = Math.min(boxWidth / measured.size.x, boxHeight / measured.size.y)
    group.scale.setScalar(fit)

    const caps = getCapabilities()

    // --- Material ------------------------------------------------------------
    // Written straight onto the material's own uniforms: three.js owns this
    // state, not React, and it changes every frame.
    const material = mesh.material as THREE.ShaderMaterial
    const uniforms = material.uniforms

    // Absent on the small-screen fallback, which uses a standard material.
    if (uniforms && uniforms.uSceneTexture) {
      // Published so the flare pass can render this same material in
      // highlight-only mode without reaching into the scene graph for it.
      glassPasses.glassMaterial = material
      uniforms.uLocalYRange.value.copy(measured.localY)
      uniforms.uSceneTexture.value = glassPasses.refraction?.texture ?? null
      uniforms.uResolution.value.set(
        state.size.width * state.viewport.dpr,
        state.size.height * state.viewport.dpr,
      )
      uniforms.uDark.value = isSurfaceDark() ? 1 : 0

      // The rim light follows the pointer's angle only. Under reduced motion it
      // holds its resting angle rather than tracking.
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

    const t = state.clock.elapsedTime
    const float = Math.sin(t * 0.6) * boxHeight * FLOAT_AMPLITUDE
    group.position.set(seat.x, seat.y + float, 0)

    const targetY = pointer.cx * TILT_Y
    const targetX = pointer.cy * TILT_X
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetY, 5, delta)
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, targetX, 5, delta)
  })

  // Subscribed, not read once: capabilities start at their server defaults and
  // resolve after mount, so choosing the material from a single render-time
  // read leaves a small screen holding the refraction shader whose pass has
  // been gated off — a shader sampling a target nobody renders.
  const caps = useSyncExternalStore(
    subscribeToCapabilities,
    getCapabilities,
    getServerCapabilities,
  )
  const glass = canRenderGlass(caps)

  return (
    <group ref={outer} visible={false}>
      <group position={[-measured.center.x, -measured.center.y, -measured.center.z]}>
        <mesh ref={meshRef} geometry={geometry} position={BAKED_POSITION} scale={BAKED_SCALE}>
          {glass ? (
            <shaderMaterial
              vertexShader={glassVertexShader}
              fragmentShader={glassFragmentShader}
              uniforms={initialUniforms}
            />
          ) : (
            // Small-screen fallback: no second scene render, no refraction.
            <meshStandardMaterial color="#8EBFE8" roughness={0.25} metalness={0.1} />
          )}
        </mesh>
      </group>
    </group>
  )
}

useGLTF.preload('/models/hello.glb')
