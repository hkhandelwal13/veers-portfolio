'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial } from '@react-three/drei'
import {
  canRenderCursor,
  canRenderGlass,
  getCapabilities,
} from '@/lib/capabilities'
import { getHeroProgress } from '@/lib/hero-progress'
import { pointer, pointerRaw } from '@/lib/pointer-bus'
import { getTargetRect } from '@/lib/rect-sampler'
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
 * drei's MeshTransmissionMaterial rather than the word's screen-space shader.
 * The word's version samples a flat picture of the scene, which is enough for a
 * large shallow object but reads as a tinted disc on a small round one — it has
 * no thickness to travel through. Transmission renders its own view through the
 * body, and its distortion terms are what make the surface crawl. It manages
 * its own buffer and hides itself while filling it, so the second full pass
 * this used to need is gone.
 *
 * Still on its own layer, so it stays out of the word's refraction: the word
 * sampling the lens sampling the word is a feedback smear within a few frames.
 */

/** Radius in world units at the depth it sits — roughly a 150px bead. */
const RADIUS = 0.32

/** How hard it chases the pointer. Lower lags more. */
const FOLLOW_LAMBDA = 13

export function CursorLens() {
  const meshRef = useRef<THREE.Mesh>(null)
  const positionRef = useRef(new THREE.Vector3())
  useEffect(() => {
    meshRef.current?.layers.set(LAYER_LENS)
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

  })

  return (
    <mesh ref={meshRef} visible={false} frustumCulled={false} renderOrder={10}>
      <icosahedronGeometry args={[RADIUS, 12]} />
      <MeshTransmissionMaterial
        // One sample and a small buffer: this is a bead in constant motion, and
        // the cost of transmission is the buffer render, which happens every
        // frame whatever the pointer is doing.
        samples={2}
        resolution={256}
        transmission={1}
        thickness={0.9}
        roughness={0.06}
        ior={1.5}
        chromaticAberration={0.09}
        anisotropy={0.15}
        // The liquid part: a moving warp through the body, rather than a fixed
        // lens shape. temporalDistortion is what keeps it crawling at rest.
        distortion={0.55}
        distortionScale={0.45}
        temporalDistortion={0.18}
        backside
        backsideThickness={0.35}
      />
    </mesh>
  )
}
