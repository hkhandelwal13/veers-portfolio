'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { canRenderGlass, getCapabilities } from '@/lib/capabilities'
import { pointer } from '@/lib/pointer-bus'
import { getTargetRect } from '@/lib/rect-sampler'
import { getScrollSnapshot } from '@/lib/scroll-bus'
import {
  depthPortraitFragmentShader,
  depthPortraitVertexShader,
} from '@/shaders/depth-portrait'
import { LAYER_CONTENT } from './layers'
import { isRectVisible, rectToWorld } from './rect-space'

/**
 * The editor's portrait, with depth.
 *
 * Seated on the About section's reserved rect like every other WebGL object, so
 * CSS still decides where it sits at every breakpoint. The flat photo underneath
 * is a real <img>, not a placeholder: where the canvas never mounts, or the
 * device is small enough that we are sparing it, that image is the portrait and
 * this simply never covers it.
 */

export const FACE_TARGET_ID = 'editor-face'

/**
 * The portrait, and the depth map that belongs to *this* photograph.
 *
 * `depth` is null until a map has been generated for the current image, and
 * while it is null this renders nothing at all: the <img> in the section is the
 * portrait, which is the same thing that happens on a device where the canvas
 * never mounts. That is the honest fallback. Pairing a new photo with the
 * previous one's depth map would not fail — it would parallax the new face
 * using the old one's geometry, sliding the shading around the jaw and
 * shoulders, which is worse than not doing it at all because it looks
 * deliberate.
 *
 * To turn it back on: generate a greyscale depth map from the same photo (white
 * near, black far — the default from every monocular depth tool), save it
 * beside the colour image, and name it here. Nothing else changes.
 */
const PORTRAIT: { color: string; depth: string | null } = {
  color: '/face-color2.png',
  depth: null,
}

/** Peak UV shift at the edges of the pointer's range. Small on purpose — this
 *  is a photograph, and past a point the march starts showing its seams. */
const PARALLAX = 0.028

export function EditorFace() {
  // The hooks below need both textures, so the guard lives out here rather than
  // inside the component that loads them.
  if (!PORTRAIT.depth) return null
  return <DepthPortrait color={PORTRAIT.color} depth={PORTRAIT.depth} />
}

function DepthPortrait({ color, depth }: { color: string; depth: string }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const camera = useThree((state) => state.camera)
  const parallaxRef = useRef(new THREE.Vector2())

  const [colorMap, depthMap] = useTexture(
    [color, depth],
    (loaded) => {
      const maps = Array.isArray(loaded) ? loaded : [loaded]
      maps.forEach((map, index) => {
        // The march walks outside 0..1 near the edges; clamping keeps those
        // reads on the border pixel rather than wrapping the face round itself.
        map.wrapS = THREE.ClampToEdgeWrapping
        map.wrapT = THREE.ClampToEdgeWrapping
        map.minFilter = THREE.LinearFilter
        map.magFilter = THREE.LinearFilter
        map.generateMipmaps = false
        // Colour is a photograph; depth is data and must not be colour-managed.
        map.colorSpace = index === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace
      })
    },
  )

  const uniforms = useMemo(
    () => ({
      uColor: { value: colorMap },
      uDepth: { value: depthMap },
      uParallax: { value: new THREE.Vector2() },
      uStrength: { value: PARALLAX },
      uFade: { value: 0 },
    }),
    [colorMap, depthMap],
  )

  useEffect(() => {
    meshRef.current?.layers.set(LAYER_CONTENT)
  }, [])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const rect = getTargetRect(FACE_TARGET_ID)
    const { viewportHeight } = getScrollSnapshot()
    const height = viewportHeight || state.size.height

    if (!rect || !rect.valid || !canRenderGlass(getCapabilities())) {
      mesh.visible = false
      return
    }
    // Culled off screen: it is a full-resolution photograph on a plane, and
    // there is nothing to gain from sampling it while the hero is up.
    if (!isRectVisible(rect, height, 200)) {
      mesh.visible = false
      return
    }
    mesh.visible = true

    const perspective = camera as THREE.PerspectiveCamera
    const seat = rectToWorld(rect, perspective, state.size.width, height)
    mesh.scale.set(rect.width * seat.unitsPerPixel, rect.height * seat.unitsPerPixel, 1)
    mesh.position.set(seat.x, seat.y, 0)

    const material = mesh.material as THREE.ShaderMaterial
    const parallax = parallaxRef.current
    const damp = 1 - Math.exp(-6 * Math.min(Math.max(delta, 0), 0.1))
    parallax.x += (pointer.cx - parallax.x) * damp
    parallax.y += (-pointer.cy - parallax.y) * damp
    material.uniforms.uParallax.value.copy(parallax)

    // Fades up rather than popping in, so the swap from the <img> underneath is
    // a cross-dissolve instead of a cut.
    const fade = material.uniforms.uFade.value
    material.uniforms.uFade.value = fade + (1 - fade) * damp
  })

  return (
    <mesh ref={meshRef} visible={false} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={depthPortraitVertexShader}
        fragmentShader={depthPortraitFragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  )
}
