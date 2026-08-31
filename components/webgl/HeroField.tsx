'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { canRenderGlass, getCapabilities } from '@/lib/capabilities'
import { getHeroProgress } from '@/lib/hero-progress'
import { getTargetRect } from '@/lib/rect-sampler'
import { subscribeToTheme } from '@/lib/theme'
import { heroFieldFragmentShader, heroFieldVertexShader } from '@/shaders/hero-field'
import { LAYER_CONTENT } from './layers'
import { isRectVisible, rectToWorld } from './rect-space'

/**
 * The hero's ground, drawn in WebGL so the glass can refract it and the pointer
 * can move it. See shaders/hero-field for why CSS could not do either.
 *
 * A plane pushed far enough back to fill the frustum behind everything else,
 * on the content layer — which is precisely the set the refraction pass
 * captures.
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
const STAGE_TARGET_ID = 'hero-stage'

/** Reads a CSS colour into a target, leaving it alone if the token is missing. */
function readColor(styles: CSSStyleDeclaration, token: string, target: THREE.Color) {
  const value = styles.getPropertyValue(token).trim()
  if (value) target.set(value)
}

const scratch = new THREE.Color()

/**
 * Splits a translucent colour token into a colour and an alpha.
 *
 * The dressing tokens carry their own alpha because one CSS element paints both
 * the hairlines and the crosses from a single colour; the shader needs the two
 * halves separately.
 *
 * Both spellings have to be handled. These are authored as `rgba(...)`, but
 * getComputedStyle hands back whatever the engine settled on — Chromium
 * serialises them as 8-digit hex — and a naive number scrape over `#6e91ff29`
 * reads "6, 91, 29", which is a dark green rather than a pale blue.
 */
function readRgba(styles: CSSStyleDeclaration, token: string, target: THREE.Vector4) {
  const value = styles.getPropertyValue(token).trim()
  if (!value) return

  if (value.startsWith('#')) {
    const hex = value.slice(1)
    // #rgba and #rrggbbaa carry the alpha in their last 1 or 2 digits.
    const short = hex.length === 4 || hex.length === 3
    const alphaDigits = hex.length === 4 || hex.length === 8 ? (short ? 1 : 2) : 0
    const rgb = hex.slice(0, hex.length - alphaDigits)
    scratch.set(`#${rgb}`)
    const alpha = alphaDigits
      ? parseInt(short ? hex.slice(-1).repeat(2) : hex.slice(-2), 16) / 255
      : 1
    target.set(scratch.r, scratch.g, scratch.b, alpha)
    return
  }

  const parts = value.match(/[\d.]+/g)
  if (!parts || parts.length < 3) return
  scratch.set(`rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`)
  target.set(scratch.r, scratch.g, scratch.b, parts.length > 3 ? Number(parts[3]) : 1)
}

export function HeroField() {
  const meshRef = useRef<THREE.Mesh>(null)
  const camera = useThree((state) => state.camera)

  const uniforms = useMemo(
    () => ({
      uGround: { value: new THREE.Color('#0a1038') },
      uGroundEnd: { value: new THREE.Color('#000000') },
      uGridMark: { value: new THREE.Vector4(0.7, 0.8, 1, 0.19) },
      uStreakGlow: { value: new THREE.Vector4(0.43, 0.57, 1, 0.16) },
      uStreakBand: { value: new THREE.Vector4(0.59, 0.69, 1, 0.075) },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uCellPx: { value: 240 },
      // Small: the matrix is a texture the ground passes through, not a
      // pattern to be read. Large cells read as polka dots.
      uDotPx: { value: 7 },
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uPixelRatio: { value: 1 },
      uAspect: { value: 1 },
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
    ground: new THREE.Color('#0a1038'),
    groundEnd: new THREE.Color('#000000'),
    gridMark: new THREE.Vector4(0.7, 0.8, 1, 0.19),
    streakGlow: new THREE.Vector4(0.43, 0.57, 1, 0.16),
    streakBand: new THREE.Vector4(0.59, 0.69, 1, 0.075),
    cellPx: 240,
  })

  useEffect(() => {
    const read = () => {
      const styles = getComputedStyle(document.documentElement)
      const palette = paletteRef.current
      readColor(styles, '--bg', palette.ground)
      readColor(styles, '--section-ground', palette.groundEnd)
      readRgba(styles, '--grid-mark', palette.gridMark)
      readRgba(styles, '--streak-glow', palette.streakGlow)
      readRgba(styles, '--streak-band', palette.streakBand)
      const cell = parseFloat(styles.getPropertyValue('--grid-cell'))
      if (Number.isFinite(cell)) palette.cellPx = cell
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
    const rect = getTargetRect(STAGE_TARGET_ID)
    const progress = getHeroProgress()
    // Visible for as long as the stage is on screen — it is the ground for two
    // sections now, so it cannot stop when the hero's own travel is done.
    if (
      !rect ||
      !rect.valid ||
      !canRenderGlass(getCapabilities()) ||
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
    material.uniforms.uGround.value.copy(palette.ground)
    material.uniforms.uGroundEnd.value.copy(palette.groundEnd)
    material.uniforms.uGridMark.value.copy(palette.gridMark)
    material.uniforms.uStreakGlow.value.copy(palette.streakGlow)
    material.uniforms.uStreakBand.value.copy(palette.streakBand)
    material.uniforms.uCellPx.value = palette.cellPx
    material.uniforms.uResolution.value.set(
      state.size.width * state.viewport.dpr,
      state.size.height * state.viewport.dpr,
    )
    material.uniforms.uAspect.value = state.size.width / Math.max(state.size.height, 1)
    material.uniforms.uPixelRatio.value = state.viewport.dpr
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uProgress.value = progress
  })

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
