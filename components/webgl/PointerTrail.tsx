'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { getCapabilities } from '@/lib/capabilities'
import { getMidSectionPresence } from '@/lib/mid-sections'
import { pointerRaw } from '@/lib/pointer-bus'
import {
  pointerTrailFragmentShader,
  pointerTrailVertexShader,
} from '@/shaders/pointer-trail'
import { LAYER_OVERLAY } from './layers'

/**
 * A pixelated neon trail behind the pointer, in the middle of the page.
 *
 * On in about, work and the arrow's approach, and off in the hero and on the
 * closing screen (lib/mid-sections): both of those have a glass object as the
 * subject and do not want a second thing drawing the eye.
 *
 * The trail is a queue of grid cells, not a queue of positions. A cell is
 * pushed only when the pointer crosses into a new one, so moving slowly leaves
 * a single block sitting there rather than a pile of coincident quads, and
 * moving fast leaves a line of separated ones — which is the whole look.
 */

/** Cell size in CSS pixels — the grid everything snaps to. */
const CELL_PX = 18
/** How many cells the tail holds. */
const TRAIL_LENGTH = 26
/** Seconds a cell takes to fade out. */
const LIFE_SECONDS = 0.65

/**
 * Longest frame the fade will advance by.
 *
 * Without it the trail's lifetime is measured in wall-clock seconds, so a
 * device managing a few frames a second ages every cell past death in the same
 * frame it was born and the effect is simply absent there — which is not a
 * graceful degradation, it is a disappearance. Clamped, a slow device gets a
 * trail that lingers instead of one that never appears.
 */
const MAX_DELTA = 1 / 30

/** BRAND_TOKENS: the lime the rings and the signature use. */
const TRAIL_COLOR = '#b8e614'

type Cell = { x: number; y: number; age: number }

export function PointerTrail() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const camera = useThree((state) => state.camera)

  /** The queue, and the cell the pointer was last seen in. */
  const trail = useRef<Cell[]>([])
  const lastCell = useRef({ x: Number.NaN, y: Number.NaN })
  const dummy = useRef(new THREE.Object3D())
  const ages = useRef(new Float32Array(TRAIL_LENGTH))

  // The initial set only. Per-frame writes go through the mesh's own material
  // below: a memo result is immutable as far as the compiler is concerned.
  const initialUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(TRAIL_COLOR) },
      uStrength: { value: 0 },
    }),
    [],
  )

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.layers.set(LAYER_OVERLAY)
    mesh.geometry.setAttribute(
      'aAge',
      new THREE.InstancedBufferAttribute(ages.current, 1),
    )
  }, [])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const caps = getCapabilities()
    const strength = getMidSectionPresence()

    // No trail without a pointer that can hover, and none under reduced motion:
    // the whole effect is a thing that follows you around.
    if (caps.reducedMotion || !caps.hoverCapable || strength <= 0.001) {
      mesh.visible = false
      trail.current.length = 0
      lastCell.current.x = Number.NaN
      return
    }
    mesh.visible = true

    const { width, height } = state.size
    const cellX = Math.floor((pointerRaw.x * width) / CELL_PX)
    const cellY = Math.floor((pointerRaw.y * height) / CELL_PX)

    if (cellX !== lastCell.current.x || cellY !== lastCell.current.y) {
      lastCell.current.x = cellX
      lastCell.current.y = cellY
      trail.current.unshift({ x: cellX, y: cellY, age: 0 })
      if (trail.current.length > TRAIL_LENGTH) trail.current.length = TRAIL_LENGTH
    }

    const step = Math.min(delta, MAX_DELTA) / LIFE_SECONDS
    for (const cell of trail.current) cell.age += step

    // World size of one cell, on the camera's focal plane.
    const perspective = camera as THREE.PerspectiveCamera
    const visibleHeight =
      2 * perspective.position.z * Math.tan((perspective.fov * Math.PI) / 360)
    const unitsPerPixel = visibleHeight / Math.max(height, 1)
    const cellWorld = CELL_PX * unitsPerPixel

    const object = dummy.current
    let drawn = 0
    for (let i = 0; i < trail.current.length; i++) {
      const cell = trail.current[i]
      if (cell.age >= 1) continue

      // Cell centre, in CSS pixels, then into world space. Y is negated: screen
      // coordinates grow downward and world space grows up.
      const px = (cell.x + 0.5) * CELL_PX
      const py = (cell.y + 0.5) * CELL_PX
      object.position.set(
        perspective.position.x + (px - width / 2) * unitsPerPixel,
        perspective.position.y - (py - height / 2) * unitsPerPixel,
        0,
      )
      object.rotation.set(0, 0, 0)
      object.scale.set(cellWorld, cellWorld, 1)
      object.updateMatrix()
      mesh.setMatrixAt(drawn, object.matrix)
      ages.current[drawn] = cell.age
      drawn++
    }

    // Everything past the live ones is parked at zero scale rather than left
    // holding a stale matrix.
    for (let i = drawn; i < TRAIL_LENGTH; i++) {
      object.position.set(0, 0, 0)
      object.scale.set(0, 0, 0)
      object.updateMatrix()
      mesh.setMatrixAt(i, object.matrix)
      ages.current[i] = 1
    }

    // Dropped once fully faded, from the back, so the queue does not grow.
    while (trail.current.length > 0 && trail.current[trail.current.length - 1].age >= 1) {
      trail.current.pop()
    }

    mesh.instanceMatrix.needsUpdate = true
    const ageAttribute = mesh.geometry.getAttribute('aAge')
    if (ageAttribute) ageAttribute.needsUpdate = true
    ;(mesh.material as THREE.ShaderMaterial).uniforms.uStrength.value = strength
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, TRAIL_LENGTH]}
      frustumCulled={false}
      visible={false}
      renderOrder={10}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={pointerTrailVertexShader}
        fragmentShader={pointerTrailFragmentShader}
        uniforms={initialUniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </instancedMesh>
  )
}
