'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { getCapabilities } from '@/lib/capabilities'
import { pointer } from '@/lib/pointer-bus'
import { getTargetRect } from '@/lib/rect-sampler'
import { getScrollSnapshot } from '@/lib/scroll-bus'
import { createRingLight } from '@/lib/ring-light'
import { isSurfaceDark } from '@/lib/surface'
import { glassFragmentShader, glassVertexShader } from '@/shaders/glass'
import { glassPasses } from './glass-passes'
import { createGlassUniforms } from './HeroHello'
import { LAYER_GLASS } from './layers'
import { flattenModel } from './model-geometry'
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

export const CONTACT_TARGET_ID = 'wordmark'

/** Grows past its reserved rect, as the hero's word does. */
const FILL = 1.08
/**
 * The same overfill once the layout stacks, where the slot IS the column.
 *
 * Crossing the reserved rect is the design on a wide screen. On a narrow one
 * the rect is the column, so 1.22 clipped the first and last letters of every
 * line against both edges — the word became unreadable exactly where reading
 * it is the point.
 */
const FILL_COMPACT = 1.0
const FLOAT_AMPLITUDE = 0.02
const TILT_X = 0.1
const TILT_Y = 0.16

/** Lying flat, face to the ceiling — where the word starts before it stands. */
const LAID_FLAT = -Math.PI / 2

/** Screens of scroll the stand-up is spread over, ending at the centre. */
const ENTRANCE_TRAVEL = 0.22

export function ContactWord() {
  const outer = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const ringLight = useRef<ReturnType<typeof createRingLight> | null>(null)

  const camera = useThree((state) => state.camera)
  const { scene } = useGLTF('/models/contact.glb?v=45f4dad7')

  const initialUniforms = useMemo(() => createGlassUniforms(), [])

  /** The word as one geometry, with its bounds — see model-geometry. */
  const measured = useMemo(() => flattenModel(scene, 'contact.glb'), [scene])

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
    group.scale.setScalar(fit * (getCapabilities().stacked ? FILL_COMPACT : FILL))

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

    // Standing up, welded to the scroll rather than chasing it.
    //
    // The scroll is the animation: the slot's centre meeting the viewport's
    // is upright, and every position between is a fixed angle. So it turns at
    // exactly the rate you scroll — a flick stands it up in a flick, a slow
    // drag walks it up under your finger — and scrolling back up lies it down
    // again by the same rule rather than by a second one written for the
    // reverse.
    //
    // Nothing is damped here, and that is the point. An earlier version
    // chased this target at a rate that rose with scroll speed, which sounds
    // like the same thing and is not: a chase is always behind, and on a slow
    // deliberate scroll — where the rate is lowest and you are watching most
    // closely — it lagged the page visibly. Lenis has already smoothed the
    // scroll; smoothing what is derived from it only adds delay.
    const centre = rect.y + rect.height / 2
    const laid = THREE.MathUtils.clamp(
      (centre - height * 0.5) / (height * ENTRANCE_TRAVEL),
      0,
      1,
    )

    // Dev-only readout: where the scroll puts it, sampled mid-scroll, which is
    // the only time a lag would exist. Stripped from production by the
    // constant condition.
    if (process.env.NODE_ENV !== 'production') {
      ;(window as unknown as { __contactWord?: unknown }).__contactWord = {
        laid: +laid.toFixed(3),
        centre: Math.round(centre),
      }
    }

    const float = Math.sin(state.clock.elapsedTime * 0.6) * boxHeight * FLOAT_AMPLITUDE
    group.position.set(seat.x, seat.y + float, 0)
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, pointer.cx * TILT_Y, 5, delta)
    // The pointer tilt is damped — the pointer jumps, and easing toward it is
    // the effect. The entrance is added on top undamped, for the reason above.
    group.rotation.x =
      THREE.MathUtils.damp(group.rotation.x - LAID_FLAT * laid, pointer.cy * TILT_X, 5, delta) +
      LAID_FLAT * laid
  })


  return (
    <group ref={outer} visible={false}>
      <group position={[-measured.center.x, -measured.center.y, -measured.center.z]}>
        <mesh ref={meshRef} geometry={measured.geometry}>
          <shaderMaterial
            vertexShader={glassVertexShader}
            fragmentShader={glassFragmentShader}
            uniforms={initialUniforms}
            transparent
          />
        </mesh>
      </group>
    </group>
  )
}

useGLTF.preload('/models/contact.glb?v=45f4dad7')
