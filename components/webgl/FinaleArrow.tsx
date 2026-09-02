'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { GLTF } from 'three-stdlib'
import { canRenderGlass, getCapabilities } from '@/lib/capabilities'
import {
  getArrowSpin,
  getFinaleProgress,
  getPortalOpen,
  getPortalZoom,
  getRayDensity,
  getRingStrength,
  getSolidity,
  isFinaleVisible,
} from '@/lib/finale-progress'
import { getScrollSnapshot } from '@/lib/scroll-bus'
import {
  portalArrowFragmentShader,
  portalArrowVertexShader,
} from '@/shaders/portal-arrow'
import { LAYER_CONTENT } from './layers'

/**
 * The finale's arrow — the same model as the hero's accent, used as a portal.
 *
 * The sequence is a pure function of scroll (lib/finale-progress): it turns and
 * swells until its silhouette is past every edge, its surface gives way to the
 * warp field behind it, and then the whole thing runs backwards. Nothing here
 * is on a clock except the field's own drift, so scrolling up plays it in
 * reverse exactly.
 *
 * On the content layer rather than the glass one: it has no refraction of its
 * own to do, and putting it where the refraction pass can see it means the
 * cursor lens bends it like everything else.
 */

type ArrowGLTF = GLTF & { nodes: { g_groupNumber_0_n3d: THREE.Mesh } }

/** The GLB's baked transform, kept so the geometry sits where it was authored. */
const BAKED_POSITION: [number, number, number] = [-5.549, 2.201, -2.095]
const BAKED_SCALE = 1.534

/** Height at rest, as a share of the viewport — the small arrow you start on. */
const IDLE_HEIGHT = 0.16

/**
 * The normal of the arrow's broad face, in the model's own space.
 *
 * Area-averaged from the GLB's normals: the two largest faces by a wide margin
 * are the front and back of the plate, and they share this axis. It is nowhere
 * near an axis of the model, because the arrow was authored on a diagonal — so
 * the identity orientation shows a three-quarter view, not the face.
 */
const FLAT_FACE_NORMAL = new THREE.Vector3(0.66321, -0.54478, 0.51319).normalize()

/**
 * Squares that face up to the camera, which looks down -Z.
 *
 * The shortest rotation that does it, so the arrow keeps as much of its
 * authored attitude as facing the camera allows; the roll after it is the one
 * hand-set number, standing the arrow up rather than leaving it leaning.
 */
const FLAT_TO_CAMERA = new THREE.Quaternion()
  .setFromUnitVectors(FLAT_FACE_NORMAL, new THREE.Vector3(0, 0, 1))
  .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.28))

export function FinaleArrow() {
  const outer = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const camera = useThree((state) => state.camera)

  const { nodes } = useGLTF('/models/arrow.glb') as unknown as ArrowGLTF
  const geometry = nodes.g_groupNumber_0_n3d.geometry

  const uniforms = useMemo(
    () => ({
      uResolution: { value: new THREE.Vector2(1, 1) },
      uAspect: { value: 1 },
      uPortal: { value: 0 },
      uSolid: { value: 1 },
      uOpacity: { value: 1 },
      uBody: { value: new THREE.Color('#1a9fff') },
      uRimColor: { value: new THREE.Color('#dcefff') },
      // The ray ramp, cool to hot — cyan through blue into violet.
      uRayCool: { value: new THREE.Color('#3ee8ff') },
      uRayMid: { value: new THREE.Color('#3a6bff') },
      uRayHot: { value: new THREE.Color('#c05cff') },
      uRingColor: { value: new THREE.Color('#b8e614') },
      uRayDensity: { value: 0 },
      uRingStrength: { value: 0 },
    }),
    [],
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
    return {
      size: box.getSize(new THREE.Vector3()),
      center: box.getCenter(new THREE.Vector3()),
    }
  }, [geometry])

  useEffect(() => {
    meshRef.current?.layers.set(LAYER_CONTENT)
  }, [])

  useFrame((state) => {
    const group = outer.current
    const mesh = meshRef.current
    if (!group || !mesh || measured.size.y === 0) return

    if (!isFinaleVisible() || !canRenderGlass(getCapabilities())) {
      group.visible = false
      return
    }
    group.visible = true

    const t = getFinaleProgress()
    const open = getPortalOpen(t)

    const perspective = camera as THREE.PerspectiveCamera
    const { viewportHeight } = getScrollSnapshot()
    const height = viewportHeight || state.size.height
    const worldHeight =
      2 * perspective.position.z * Math.tan((perspective.fov * Math.PI) / 360)

    const fit = (worldHeight * IDLE_HEIGHT) / measured.size.y
    group.scale.setScalar(fit * getPortalZoom(t))
    group.position.set(0, 0, 0)

    // One whole revolution on the way in and another on the way out (see
    // getArrowSpin). Turning about Y is what shows the arrow's depth — it goes
    // edge-on at each half-turn and flat-on again at each whole one — and since
    // both turns are whole, the flat face is squared up to the camera at rest
    // and again once it has collapsed back. A tilt on X rides the same angle so
    // the silhouette is never a dead cut-out, and it is zero wherever the spin
    // is a multiple of π, which includes both ends.
    const spin = getArrowSpin(t)
    group.rotation.set(Math.sin(spin) * 0.18, spin, 0)

    const material = mesh.material as THREE.ShaderMaterial
    material.uniforms.uResolution.value.set(
      state.size.width * state.viewport.dpr,
      state.size.height * state.viewport.dpr,
    )
    material.uniforms.uAspect.value = state.size.width / Math.max(height, 1)
    material.uniforms.uPortal.value = open
    material.uniforms.uSolid.value = getSolidity(t)
    material.uniforms.uRayDensity.value = getRayDensity(t)
    material.uniforms.uRingStrength.value = getRingStrength(t)
  })

  return (
    <group ref={outer} visible={false}>
      {/* Fixed: turns the plate to face the camera, so the spin above starts
          and ends flat-on. Separate from the spin because it is a property of
          the model, not of the timeline. */}
      <group quaternion={FLAT_TO_CAMERA}>
        <group position={[-measured.center.x, -measured.center.y, -measured.center.z]}>
          <mesh ref={meshRef} geometry={geometry} position={BAKED_POSITION} scale={BAKED_SCALE}>
            <shaderMaterial
              vertexShader={portalArrowVertexShader}
              fragmentShader={portalArrowFragmentShader}
              uniforms={uniforms}
              // Both faces: once it is bigger than the frustum the camera is
              // inside the mesh, and a back-face cull would empty the screen at
              // exactly the moment the sequence peaks.
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      </group>
    </group>
  )
}
