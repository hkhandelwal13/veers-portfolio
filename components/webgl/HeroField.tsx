'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { canRenderGlass } from '@/lib/capabilities'
import { getTargetRect } from '@/lib/rect-sampler'
import { subscribeToTheme } from '@/lib/theme'
import { heroFieldFragmentShader, heroFieldVertexShader } from '@/shaders/hero-field'
import { LAYER_CONTENT } from './layers'
import { isRectVisible, rectToWorld } from './rect-space'

/**
 * A section's ground, drawn in WebGL so the glass has something to refract.
 * See shaders/hero-field for why CSS could not serve.
 *
 * A plane pushed far enough back to sit behind everything else, on the content
 * layer — which is precisely the set the refraction pass captures.
 *
 * Parameterised because the site has two of these: the hero's, which spans
 * three sections and dissolves into the next one's colour on scroll, and the
 * contact screen's, which arrives out of that colour instead. They differ only
 * in which rect they sit on and which direction their progress runs.
 */

/** Behind the stickers, which sit at -4.5 and back. */
const FIELD_Z = -9

/** The hero section's own rect — not the word's slot. Stickers and the arrow
 *  key off this, so they stay inside the hero. */
export const FIELD_TARGET_ID = 'hero-field'

/**
 * The hero *and* the section it hands over to.
 *
 * The ground is seated on both, as one plane, because that is what removes the
 * dividing line: with nothing else painting a background down there, the dot
 * matrix's own coverage is the only thing turning the ground black, and one
 * surface cannot disagree with itself about how far along it is.
 */
export const STAGE_TARGET_ID = 'hero-stage'

/** Reads a CSS colour into a target, leaving it alone if the token is missing. */
function readColor(styles: CSSStyleDeclaration, token: string, target: THREE.Color) {
  const value = styles.getPropertyValue(token).trim()
  if (value) target.set(value)
}

export function SectionField({
  targetId,
  /** 0 = the section's own ground, 1 = fully handed over to --section-ground. */
  progress,
  /**
   * How much earlier the handover reaches the top of the plane than the bottom.
   *
   * The hero's ground spans several sections and wants the gradient — it is
   * what makes the dot matrix arrive from one end rather than everywhere at
   * once. A plane the size of one section wants it flat, or its top edge
   * disagrees with whatever plane is above it and the join shows.
   */
  wipeBias = [2.4, 0.35],
  /**
   * Share of the plane's height held fully handed over at the top.
   *
   * Only meaningful on a plane the size of one section, where the top edge is
   * on screen while the ground is arriving. The hero's spans several sections
   * and its top is the top of the page.
   */
  topFade = 0,
}: {
  targetId: string
  progress: () => number
  wipeBias?: [number, number]
  topFade?: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const camera = useThree((state) => state.camera)

  const uniforms = useMemo(
    () => ({
      uGroundEnd: { value: new THREE.Color('#000000') },
      uWashLight: { value: new THREE.Color('#143ad6') },
      uWashLight2: { value: new THREE.Color('#1330a8') },
      uWashCore: { value: new THREE.Color('#07144a') },
      uWashMid: { value: new THREE.Color('#040c2e') },
      uWashEdge: { value: new THREE.Color('#020617') },
      uResolution: { value: new THREE.Vector2(1, 1) },
      // Small: the matrix is a texture the ground passes through, not a
      // pattern to be read. Large cells read as polka dots.
      uDotPx: { value: 7 },
      uProgress: { value: 0 },
      uWipeBias: { value: new THREE.Vector2(2.4, 0.35) },
      uTopFade: { value: 0 },
      uPixelRatio: { value: 1 },
    }),
    [],
  )

  /**
   * The palette, read from the CSS tokens rather than restated here so the
   * shader and the CSS dressing cannot drift.
   *
   * A ref, not the uniforms themselves: a useMemo result is immutable as far as
   * the compiler is concerned, and these have to be rewritten whenever the
   * theme remaps a token. useFrame copies them across, where the material is
   * reached through the mesh ref and mutation is fine.
   */
  const paletteRef = useRef({
    groundEnd: new THREE.Color('#000000'),
    washLight: new THREE.Color('#143ad6'),
    washLight2: new THREE.Color('#1330a8'),
    washCore: new THREE.Color('#07144a'),
    washMid: new THREE.Color('#040c2e'),
    washEdge: new THREE.Color('#020617'),
  })

  useEffect(() => {
    const read = () => {
      const styles = getComputedStyle(document.documentElement)
      const palette = paletteRef.current
      readColor(styles, '--section-ground', palette.groundEnd)
      readColor(styles, '--wash-light', palette.washLight)
      readColor(styles, '--wash-light-2', palette.washLight2)
      readColor(styles, '--wash-core', palette.washCore)
      readColor(styles, '--wash-mid', palette.washMid)
      readColor(styles, '--wash-edge', palette.washEdge)
    }
    read()
    return subscribeToTheme(read)
  }, [])

  useEffect(() => {
    meshRef.current?.layers.set(LAYER_CONTENT)
  }, [])

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return

    // No glass means no refraction to feed and a device we are already sparing;
    // the CSS dressing is showing through underneath either way.
    const rect = getTargetRect(targetId)
    const value = progress()
    // Visible for as long as the stage is on screen — it is the ground for two
    // sections now, so it cannot stop when the hero's own travel is done.
    if (
      !rect ||
      !rect.valid ||
      !canRenderGlass() ||
      !isRectVisible(rect, state.size.height, 200)
    ) {
      mesh.visible = false
      return
    }
    mesh.visible = true

    // Seated on the section's rect, with the usual perspective compensation:
    // rectToWorld measures at z=0, and this plane sits further back, so both
    // the size and the offset scale by the ratio of the two distances.
    const perspective = camera as THREE.PerspectiveCamera
    const seat = rectToWorld(rect, perspective, state.size.width, state.size.height)
    const depth = (perspective.position.z - FIELD_Z) / perspective.position.z
    mesh.scale.set(
      rect.width * seat.unitsPerPixel * depth,
      rect.height * seat.unitsPerPixel * depth,
      1,
    )
    mesh.position.set(seat.x * depth, seat.y * depth, FIELD_Z)

    const material = mesh.material as THREE.ShaderMaterial
    const palette = paletteRef.current
    material.uniforms.uGroundEnd.value.copy(palette.groundEnd)
    material.uniforms.uWashLight.value.copy(palette.washLight)
    material.uniforms.uWashLight2.value.copy(palette.washLight2)
    material.uniforms.uWashCore.value.copy(palette.washCore)
    material.uniforms.uWashMid.value.copy(palette.washMid)
    material.uniforms.uWashEdge.value.copy(palette.washEdge)
    material.uniforms.uResolution.value.set(
      state.size.width * state.viewport.dpr,
      state.size.height * state.viewport.dpr,
    )
    material.uniforms.uPixelRatio.value = state.viewport.dpr
    material.uniforms.uProgress.value = value
    material.uniforms.uWipeBias.value.set(wipeBias[0], wipeBias[1])
    material.uniforms.uTopFade.value = topFade
  }, -2.5)

  return (
    <mesh ref={meshRef} visible={false} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={heroFieldVertexShader}
        fragmentShader={heroFieldFragmentShader}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  )
}

