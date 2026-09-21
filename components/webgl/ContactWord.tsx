'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { mergeBufferGeometries } from 'three-stdlib'
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

/**
 * A plain float copy of an attribute.
 *
 * The packed model is quantized (KHR_mesh_quantization), so its positions and
 * normals arrive as normalized integers with the real scale carried on the
 * node. Transforming one of those in place truncates every coordinate to a
 * whole number — the word collapses into a row of flat slabs, which is a
 * convincing enough shape to look like a loading bug rather than a rounding
 * one. getX/getY/getZ denormalize, so this reads the values the file actually
 * means and writes them somewhere that can hold them.
 */
function toFloatAttribute(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): THREE.BufferAttribute {
  const { count, itemSize } = attribute
  const values = new Float32Array(count * itemSize)
  for (let i = 0; i < count; i++) {
    const at = i * itemSize
    values[at] = attribute.getX(i)
    if (itemSize > 1) values[at + 1] = attribute.getY(i)
    if (itemSize > 2) values[at + 2] = attribute.getZ(i)
  }
  return new THREE.BufferAttribute(values, itemSize)
}

/** Grows past its reserved rect, as the hero's word does. */
const FILL = 1.22
/**
 * The same overfill once the layout stacks, where the slot IS the column.
 *
 * Crossing the reserved rect is the design on a wide screen. On a narrow one
 * the rect is the column, so 1.22 clipped the first and last letters of every
 * line against both edges — the word became unreadable exactly where reading
 * it is the point.
 */
const FILL_COMPACT = 0.98
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
  const { scene } = useGLTF('/models/contact.glb')

  const initialUniforms = useMemo(() => createGlassUniforms(), [])

  /**
   * One geometry for the whole word, with every part's own transform baked in,
   * and its bounds.
   *
   * Read off the loaded asset rather than from a hard-coded node name and a
   * pair of transcribed constants. The word has been re-exported twice now, and
   * each export changed both: the first was a single node called
   * g_groupNumber_0_n3d carrying a position and a uniform scale, the second was
   * nine nodes at identity with the coordinates in the vertices, and the packed
   * build is one node called mesh_0 with a quantization scale of 0.001. Naming
   * any of that in the component means the next export renders a ninth of the
   * word, or throws on a node that no longer exists.
   *
   * Merged rather than rendered as nine meshes because everything downstream
   * assumes one: the layer assignment, the refraction pass's view of it, and
   * the tint gradient, which normalises against a single local Y range.
   *
   * Still not Box3.setFromObject on the mounted object — that measures in world
   * space and folds in whatever scale this component has already applied, so it
   * shrinks the word a little more on every remount.
   */
  const measured = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []

    scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return

      // Only position and normal: that is all the glass shader reads, and
      // merging requires every part to carry the same attributes — an export
      // with UVs on some meshes and not others fails outright.
      const part = new THREE.BufferGeometry()
      part.setAttribute('position', toFloatAttribute(mesh.geometry.attributes.position))
      if (mesh.geometry.attributes.normal) {
        part.setAttribute('normal', toFloatAttribute(mesh.geometry.attributes.normal))
      }
      if (mesh.geometry.index) part.setIndex(mesh.geometry.index.clone())

      // Recomputed from the ancestors at this moment, so it is the transform
      // inside the GLB and not whatever the cached scene was last mounted under.
      mesh.updateWorldMatrix(true, false)
      part.applyMatrix4(mesh.matrixWorld)
      parts.push(part)
    })

    const geometry = parts.length === 1 ? parts[0] : mergeBufferGeometries(parts, false)
    if (parts.length > 1) for (const part of parts) part.dispose()
    if (!geometry) throw new Error('contact.glb: no mesh to render')

    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    return {
      geometry,
      size: box.getSize(new THREE.Vector3()),
      center: box.getCenter(new THREE.Vector3()),
      // Post-transform, because the mesh below renders this geometry at
      // identity — so this IS what the vertex shader sees.
      localY: new THREE.Vector2(box.min.y, box.max.y),
    }
  }, [scene])

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

useGLTF.preload('/models/contact.glb')
