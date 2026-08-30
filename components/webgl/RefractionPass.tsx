'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { canRenderGlass, canRenderStarFlare, getCapabilities } from '@/lib/capabilities'
import { fullscreenVertexShader, star6FragmentShader } from '@/shaders/star6'
import { isSurfaceDark } from '@/lib/surface'
import { glassPasses } from './glass-passes'
import { ALL_LAYERS_MASK, LAYER_CONTENT, LAYER_GLASS, LAYER_OVERLAY } from './layers'

/** The flare's source and streaks both run at half resolution. */
const STAR_SCALE = 0.5

const BLACK = new THREE.Color(0x000000)

/**
 * All the offscreen rendering, in one place, before anything reads it.
 *
 * Runs at useFrame priority -2: negative priorities only affect ordering, so
 * R3F still renders the visible frame itself afterwards. That is deliberate —
 * taking over the main render to add a post pass would mean owning the whole
 * pipeline, when all the flare actually needs is an additive quad drawn inside
 * the normal scene.
 *
 * Per frame:
 *   1. everything except the glass  → refraction target (full res)
 *   2. the glass alone              → highlight source (half res, alternate frames)
 *   3. six-ray streaks              → star target    (half res, alternate frames)
 *
 * Pass 1 is what makes refraction possible at all. Passes 2 and 3 stop
 * completely when the glass is offscreen: there is no reason to pay for
 * highlights that cannot be seen.
 */
export function RefractionPass() {
  const size = useThree((state) => state.size)
  const dpr = useThree((state) => state.viewport.dpr)

  const frame = useRef(0)

  // The page's own ground colour, read once from the CSS tokens.
  //
  // The canvas is transparent and the background is painted by CSS, so as far
  // as WebGL is concerned the space behind the glass is empty — and refracting
  // an empty target renders the word solid black. Clearing to the page colour
  // is what makes refraction of "nothing" look like refraction of the page.
  const groundRef = useRef({ light: new THREE.Color('#e7e4dd'), dark: new THREE.Color('#16161a') })
  const scratchColor = useRef(new THREE.Color())

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement)
    const light = styles.getPropertyValue('--bg').trim()
    const dark = styles.getPropertyValue('--dark-bg').trim()
    if (light) groundRef.current.light.set(light)
    if (dark) groundRef.current.dark.set(dark)
  }, [])

  // A scene of its own for the streak pass — one fullscreen quad and an
  // orthographic camera, never touched by the main render. Built once into a
  // ref: its uniforms change every frame, which a memo result must not.
  const starRef = useRef<{ scene: THREE.Scene; material: THREE.ShaderMaterial } | null>(null)
  const starCamera = useRef(new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1))

  useEffect(() => {
    const scene = new THREE.Scene()
    const material = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: star6FragmentShader,
      uniforms: {
        uSource: { value: null as THREE.Texture | null },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uThreshold: { value: 0.62 },
        uStreakScale: { value: 2.2 },
        uIntensity: { value: 0.9 },
      },
      depthTest: false,
      depthWrite: false,
    })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    quad.frustumCulled = false
    scene.add(quad)
    starRef.current = { scene, material }

    return () => {
      quad.geometry.dispose()
      material.dispose()
      starRef.current = null
    }
  }, [])

  // Targets follow the canvas. Recreated on resize rather than resized in place
  // so there is never a frame sampling a stale attachment.
  useEffect(() => {
    const width = Math.max(1, Math.floor(size.width * dpr))
    const height = Math.max(1, Math.floor(size.height * dpr))
    const starWidth = Math.max(1, Math.floor(width * STAR_SCALE))
    const starHeight = Math.max(1, Math.floor(height * STAR_SCALE))

    const options = { type: THREE.HalfFloatType }
    const refraction = new THREE.WebGLRenderTarget(width, height, options)
    const glassOnly = new THREE.WebGLRenderTarget(starWidth, starHeight, options)
    const star = new THREE.WebGLRenderTarget(starWidth, starHeight, options)

    glassPasses.refraction = refraction
    glassPasses.glassOnly = glassOnly
    glassPasses.star = star
    starRef.current?.material.uniforms.uTexel.value.set(1 / starWidth, 1 / starHeight)

    return () => {
      glassPasses.refraction = null
      glassPasses.glassOnly = null
      glassPasses.star = null
      refraction.dispose()
      glassOnly.dispose()
      star.dispose()
    }
  }, [size.width, size.height, dpr])

  useFrame((state) => {
    // Renderer, scene and camera come from the frame state rather than from
    // useThree: these passes mutate the camera's layer mask, and a value read
    // through a hook at render time is not ours to modify.
    const { gl, scene, camera } = state

    // A camera sees only layer 0 by default, so without this the glass and the
    // flare composite would render into the passes below and then never appear
    // on screen. Cheap enough to assert every frame, and it survives R3F
    // swapping the default camera.
    if ((camera.layers.mask & ALL_LAYERS_MASK) !== ALL_LAYERS_MASK) {
      camera.layers.enable(LAYER_GLASS)
      camera.layers.enable(LAYER_OVERLAY)
    }

    const caps = getCapabilities()
    if (!canRenderGlass(caps)) return

    const refraction = glassPasses.refraction
    const glassOnly = glassPasses.glassOnly
    const star = glassPasses.star
    if (!refraction || !glassOnly || !star) return

    frame.current += 1

    const previousMask = camera.layers.mask
    const previousTarget = gl.getRenderTarget()
    const previousClearAlpha = gl.getClearAlpha()
    gl.getClearColor(scratchColor.current)

    // 1. The scene the glass refracts: content only, so the glass cannot
    //    sample itself and the flare composite cannot feed back into it.
    //    Cleared to the page's ground colour rather than to nothing, so the
    //    glass refracts the page instead of a void.
    const ground = isSurfaceDark() ? groundRef.current.dark : groundRef.current.light
    camera.layers.set(LAYER_CONTENT)
    gl.setRenderTarget(refraction)
    gl.setClearColor(ground, 1)
    gl.clear()
    gl.render(scene, camera)

    // 2 + 3. Highlights and streaks, only when they can be seen, and only on
    //        alternate frames — the flare is soft and wide, so the halved
    //        update rate is invisible while the saving is not.
    const starPass = starRef.current
    if (
      starPass &&
      canRenderStarFlare(caps) &&
      glassPasses.glassVisible &&
      frame.current % 2 === 0
    ) {
      // Black, not the ground colour: this target feeds a luminance threshold,
      // and clearing it to paper would make the whole frame read as a highlight
      // and put streaks over the entire page.
      camera.layers.set(LAYER_GLASS)
      gl.setClearColor(BLACK, 0)
      gl.setRenderTarget(glassOnly)
      gl.clear()
      gl.render(scene, camera)

      starPass.material.uniforms.uSource.value = glassOnly.texture
      gl.setRenderTarget(star)
      gl.setClearColor(BLACK, 0)
      gl.clear()
      gl.render(starPass.scene, starCamera.current)
    }

    camera.layers.mask = previousMask === 0 ? ALL_LAYERS_MASK : previousMask
    gl.setClearColor(scratchColor.current, previousClearAlpha)
    gl.setRenderTarget(previousTarget)
  }, -2)

  return null
}
