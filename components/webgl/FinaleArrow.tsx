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
  computeArrowCentroid,
  computeArrowSpinAxis,
} from './arrow-attitude'
import {
  FINALE_ARROW_ID,
  getArrowScale,
  getArrowSpin,
  getEntryScale,
  getFinaleProgress,
  getGrowth,
  getPortalMix,
  getRayDensity,
  getRingLive,
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
 * un-pinned the rect is below the fold, so the arrow rises into frame through
 * the last row of work cards — the section is overlapped with the grid for
 * most of that approach, see Finale.module.css — and on the way out the same
 * rect carries it up over the closing screen. Parked at the origin it would
 * instead hang in the middle of the work grid for the whole approach.
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
 * Refraction offset where the pass is available.
 *
 * Mirrors what applyFlatArrowDefinition sets, because the frame loop below
 * rewrites this uniform every frame to switch the flat-grey fallback in and
 * out — so a different value here would quietly undo the flat-face treatment.
 */
const REFRACT_STRENGTH = 0.24

/** Idle float and pointer parallax, as the hero's word has them. */
const FLOAT_AMPLITUDE = 0.02
const TILT_X = 0.1
const TILT_Y = 0.16

export function FinaleArrow() {
  const outer = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  /** Scratch quaternions — rebuilt every frame, so never memo results. */
  const spinQuat = useRef(new THREE.Quaternion())
  const tiltQuat = useRef(new THREE.Quaternion())
  const tiltEuler = useRef(new THREE.Euler())
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
    uniforms.uTintDark.value.set('#2196f3')
    uniforms.uTintLight.value.set('#a5e8ff')
    uniforms.uTintSecondary.value.set('#2196f3')
    uniforms.uTintAmount.value = 0.95
    // The rim and specular default to a warm cream, which is right for the
    // hero's word over a blue field and wrong here. Highlight is added on top
    // of the body, and adding warm white to azure lifts red faster than green:
    // the arrow came out periwinkle down its lit edge and violet where the
    // Fresnel is widest, instead of the one flat blue the reference holds. A
    // cool highlight keeps every bit of the 3D definition and none of the hue
    // drift. Set here rather than in createGlassUniforms so the hero's `hello`
    // keeps the warm highlight it was tuned with.
    uniforms.uRimColor.value.set('#AEE2FF')
    // It rests face-on here too, at the start and the end of the sequence.
    applyFlatArrowDefinition(uniforms)
    return {
      ...uniforms,
      // The tunnel's half, spliced into the same material.
      uPortal: { value: 0 },
      uRayDensity: { value: 0 },
      uTravel: { value: 0 },
      uRingPhase: { value: 0 },
      uRingLive: { value: 0 },
      uAspect: { value: 1 },
      uFine: { value: 1 },
      // The ray ramp, cool to hot — cyan through blue into violet.
      uRayCool: { value: new THREE.Color('#3ee8ff') },
      uRayMid: { value: new THREE.Color('#3a6bff') },
      uRayHot: { value: new THREE.Color('#c05cff') },
      uRingColor: { value: new THREE.Color('#b8e614') },
    }
  }, [])

  /**
   * The axis the arrow turns about, and the point that axis runs through.
   *
   * Both derived from the mesh — see arrow-attitude. The finale used to spin
   * this group about world Y, which for a flat plate is a page-turn: it goes
   * edge-on halfway round and the two halves swap sides, which reads as the
   * arrow swinging about its lower corner rather than rolling. Same axis the
   * hero's arrow already uses, so the two turns are the same move.
   */
  const spinAxis = useMemo(() => computeArrowSpinAxis(geometry), [geometry])

  /**
   * The centroid, carried through the GLB's baked transform.
   *
   * This group's child applies BAKED_POSITION and BAKED_SCALE, so the offset
   * that brings the spin point to this group's origin has to be measured on
   * the far side of them.
   */
  const pivot = useMemo(
    () =>
      computeArrowCentroid(geometry)
        .multiplyScalar(BAKED_SCALE)
        .add(new THREE.Vector3(...BAKED_POSITION)),
    [geometry],
  )

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
    group.scale.setScalar(fit * getArrowScale(t) * getEntryScale())

    const caps = getCapabilities()
    const glass = canRenderGlass()
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
      uniforms.uRingLive.value = getRingLive(t)
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

    // Quaternions rather than Euler angles, because the spin axis is a
    // direction in the arrow's own plane rather than one of the world's: the
    // pointer tilt is a world-space lean, and the spin rides inside it.
    tiltEuler.current.set(pointer.cy * TILT_X * calm, pointer.cx * TILT_Y * calm, 0)
    tiltQuat.current.setFromEuler(tiltEuler.current)
    spinQuat.current.setFromAxisAngle(spinAxis, getArrowSpin(t))
    group.quaternion.copy(tiltQuat.current).multiply(spinQuat.current)
  })

  return (
    <group ref={outer} visible={false}>
      {/* Fixed: faces the plate at the camera and points it where it rests, so
          the spin above starts and ends flat-on. A property of the model, not
          of the timeline, which is why it is not in the frame loop. */}
      <group quaternion={ARROW_REST_ATTITUDE}>
        <group position={[-pivot.x, -pivot.y, -pivot.z]}>
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
