'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { GLTF } from 'three-stdlib'
import { canRenderGlass, getCapabilities } from '@/lib/capabilities'
import {
  FINALE_ARROW_ID,
  getArrowScale,
  getArrowSpin,
  getFinaleProgress,
  getGrowth,
  getPortalMix,
  getRayDensity,
  getRingPhase,
  getWarpTravel,
} from '@/lib/finale-progress'
import { pointer } from '@/lib/pointer-bus'
import { getTargetRect } from '@/lib/rect-sampler'
import { createRingLight } from '@/lib/ring-light'
import { getScrollSnapshot } from '@/lib/scroll-bus'
import { isSurfaceDark } from '@/lib/surface'
import {
  portalArrowFragmentShader,
  portalArrowVertexShader,
} from '@/shaders/portal-arrow'
import { glassPasses } from './glass-passes'
import { createGlassUniforms } from './HeroHello'
import { LAYER_GLASS } from './layers'
import { isRectVisible, rectToWorld } from './rect-space'

/**
 * The finale's arrow — the hero's glass, used as a vehicle.
 *
 * Same material as the `hello`: screen-space refraction with dispersion, the
 * pointer-driven ring light, the rim and the specular — with the warp tunnel
 * spliced into the end of it (shaders/portal-arrow). What it does is different:
 * the hero's word floats and tilts where it sits, and this one is scrubbed
 * (lib/finale-progress) from a small object at the far end of the section to
 * something the camera passes through.
 *
 * The tunnel lives inside this material rather than on a quad of its own, so
 * the silhouette is the only mask it needs: the field is in the arrow while the
 * arrow is small, fills the frame once the arrow is past every edge, and
 * withdraws into it again on the way out.
 *
 * Seated on the sticky stage's own rect rather than parked at the world
 * origin. That is what puts it *in* its section: while the stage is still
 * un-pinned the rect is below the fold, so the arrow rises into frame as the
 * work grid leaves, and on the way out the same rect carries it up over the
 * closing screen. Parked at the origin it would instead hang in the middle of
 * the work grid for the whole approach.
 *
 * On the glass layer, so the refraction pass renders the page without it and
 * the arrow has something to bend while it is still an object.
 */

type ArrowGLTF = GLTF & { nodes: { g_groupNumber_0_n3d: THREE.Mesh } }

/** The GLB's baked transform, kept so the geometry sits where it was authored. */
const BAKED_POSITION: [number, number, number] = [-5.549, 2.201, -2.095]
const BAKED_SCALE = 1.534

/** Height at rest, as a share of the stage — the small arrow you start on. */
const IDLE_HEIGHT = 0.14

/**
 * The normal of the arrow's broad face, in the model's own space.
 *
 * Area-averaged from the GLB's normals: the two largest faces by a wide margin
 * are the front and back of the plate, and they share this axis. It is nowhere
 * near an axis of the model, because the arrow was authored on a diagonal — so
 * the identity orientation shows a three-quarter view, not the face.
 */
const FLAT_FACE_NORMAL = new THREE.Vector3(0.66321, -0.54478, 0.51319).normalize()

/** Which way the arrow points at rest: up and to the left, at an angle. */
const REST_ROLL = 1.28

/**
 * Squares the plate up to the camera, which looks down -Z, then rolls it into
 * its resting heading.
 *
 * The shortest rotation that faces it, so the arrow keeps as much of its
 * authored attitude as facing the camera allows; the roll is the one hand-set
 * number.
 */
const REST_ATTITUDE = new THREE.Quaternion()
  .setFromUnitVectors(FLAT_FACE_NORMAL, new THREE.Vector3(0, 0, 1))
  .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), REST_ROLL))

/** The hero's refraction offset, kept so the two materials match where both run. */
const REFRACT_STRENGTH = 0.16

/** Idle float and pointer parallax, as the hero's word has them. */
const FLOAT_AMPLITUDE = 0.02
const TILT_X = 0.1
const TILT_Y = 0.16

export function FinaleArrow() {
  const outer = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const ringLight = useRef<ReturnType<typeof createRingLight> | null>(null)
  const camera = useThree((state) => state.camera)

  const { nodes } = useGLTF('/models/arrow.glb') as unknown as ArrowGLTF
  const geometry = nodes.g_groupNumber_0_n3d.geometry

  /**
   * The hero's glass, retuned for a black stage.
   *
   * The tints in createGlassUniforms were picked against the hero's blue field,
   * where the refraction already carries most of the colour. Here the ground is
   * the black the work grid handed over, so the refracted scene is nearly
   * nothing and the dark theme's Hard Light has almost no base to lift — every
   * channel of the tint below 0.5 multiplies it back down to zero. Brand blues
   * whose green and blue channels sit above 0.5 are what keep the arrow the
   * bright object the reference shows rather than a navy silhouette.
   */
  /** Stands in for the refraction target where that pass is gated off. */
  const flatScene = useMemo(() => {
    const texture = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1)
    texture.needsUpdate = true
    return texture
  }, [])

  const initialUniforms = useMemo(() => {
    const uniforms = createGlassUniforms()
    uniforms.uTintDark.value.set('#1a9fff')
    uniforms.uTintLight.value.set('#7fd0ff')
    uniforms.uTintSecondary.value.set('#3a6bff')
    uniforms.uTintAmount.value = 0.92
    uniforms.uRimStrength.value = 0.85
    uniforms.uSpecStrength.value = 1.3
    return {
      ...uniforms,
      // The tunnel's half, spliced into the same material.
      uPortal: { value: 0 },
      uRayDensity: { value: 0 },
      uTravel: { value: 0 },
      uRingPhase: { value: 0 },
      uAspect: { value: 1 },
      uFine: { value: 1 },
      // The ray ramp, cool to hot — cyan through blue into violet.
      uRayCool: { value: new THREE.Color('#3ee8ff') },
      uRayMid: { value: new THREE.Color('#3a6bff') },
      uRayHot: { value: new THREE.Color('#c05cff') },
      uRingColor: { value: new THREE.Color('#b8e614') },
    }
  }, [])

  /** Bounds from the geometry and its baked transform, never Box3 on the
   *  mounted object — that measures in world space and folds in the scale this
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
    if (!group || !mesh || measured.size.y === 0) return

    const rect = getTargetRect(FINALE_ARROW_ID)
    const { viewportHeight } = getScrollSnapshot()
    const height = viewportHeight || state.size.height

    const t = getFinaleProgress()

    if (!rect || !isRectVisible(rect, height, 300)) {
      group.visible = false
      return
    }
    group.visible = true

    const seat = rectToWorld(rect, camera as THREE.PerspectiveCamera, state.size.width, height)
    const boxHeight = rect.height * seat.unitsPerPixel
    const fit = (boxHeight * IDLE_HEIGHT) / measured.size.y
    group.scale.setScalar(fit * getArrowScale(t))

    const caps = getCapabilities()
    const glass = canRenderGlass(caps)
    const material = mesh.material as THREE.ShaderMaterial
    const uniforms = material.uniforms

    if (uniforms && uniforms.uSceneTexture) {
      uniforms.uLocalYRange.value.copy(measured.localY)
      // Where the refraction pass is gated off there is no picture of the page
      // to bend, so the arrow refracts a flat grey and the tint does the rest.
      // It still has to be the same shader: the tunnel lives inside it, and a
      // standard material on a small screen means eight viewports of finale
      // with nothing in them.
      uniforms.uSceneTexture.value = glass ? (glassPasses.refraction?.texture ?? null) : flatScene
      uniforms.uRefractStrength.value = glass ? REFRACT_STRENGTH : 0
      uniforms.uFine.value = caps.compact ? 0 : 1
      uniforms.uResolution.value.set(
        state.size.width * state.viewport.dpr,
        state.size.height * state.viewport.dpr,
      )
      uniforms.uDark.value = isSurfaceDark() ? 1 : 0
      uniforms.uPixelRatio.value = state.viewport.dpr

      uniforms.uPortal.value = getPortalMix(t)
      uniforms.uRayDensity.value = getRayDensity(t)
      uniforms.uTravel.value = getWarpTravel(t)
      uniforms.uRingPhase.value = getRingPhase(t)
      uniforms.uAspect.value = state.size.width / Math.max(height, 1)

      const ring = caps.reducedMotion
        ? ringLight.current?.update(0, 0, false, delta)
        : ringLight.current?.update(pointer.cx, pointer.cy, pointer.inside, delta)
      if (ring) uniforms.uLightDirection.value.set(ring.x, ring.y, 0.6)
    }

    // The float and the pointer tilt belong to the arrow at rest. They are
    // faded out over the first part of the growth rather than switched off, so
    // the hand-off from "an object on the page" to "something you are
    // travelling toward" has no seam in it.
    const calm = caps.reducedMotion ? 0 : 1 - Math.min(getGrowth(t) / 0.22, 1)
    const float = Math.sin(state.clock.elapsedTime * 0.6) * boxHeight * IDLE_HEIGHT * FLOAT_AMPLITUDE
    group.position.set(seat.x, seat.y + float * calm, 0)

    group.rotation.set(pointer.cy * TILT_X * calm, getArrowSpin(t) + pointer.cx * TILT_Y * calm, 0)
  })

  return (
    <group ref={outer} visible={false}>
      {/* Fixed: faces the plate at the camera and points it where it rests, so
          the spin above starts and ends flat-on. A property of the model, not
          of the timeline, which is why it is not in the frame loop. */}
      <group quaternion={REST_ATTITUDE}>
        <group position={[-measured.center.x, -measured.center.y, -measured.center.z]}>
          <mesh ref={meshRef} geometry={geometry} position={BAKED_POSITION} scale={BAKED_SCALE}>
            <shaderMaterial
              vertexShader={portalArrowVertexShader}
              fragmentShader={portalArrowFragmentShader}
              uniforms={initialUniforms}
              transparent
              // Once it is bigger than the frustum the camera is inside the
              // mesh, and a back-face cull would empty the screen at exactly
              // the moment the sequence peaks.
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/arrow.glb')
