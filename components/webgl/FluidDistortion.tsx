'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import {
  getCapabilities,
  getServerCapabilities,
  subscribeToCapabilities,
} from '@/lib/capabilities'
import { resolveFluidConfig, type FluidConfig } from '@/lib/fluid-config'
import { getFluidStrength } from '@/lib/fluid-zones'
import { configurePointerVelocity, pointerVelocity } from '@/lib/pointer-velocity'
import { fluidDistortionFragmentShader } from '@/shaders/fluid-distortion'
import { flowmapFragmentShader } from '@/shaders/flowmap'
import { fullscreenVertexShader } from '@/shaders/fullscreen'

/**
 * WebGL fluid distortion — the pointer stirs a velocity field, and the field
 * pushes the rendered frame around.
 *
 * ── How it sits in the existing pipeline ────────────────────────────────────
 * This site already had one canvas, one scene, and two things doing offscreen
 * work inside it: FrameDriver, which owns the app's only rAF through
 * addEffect, and RefractionPass, which renders the scene-minus-glass into a
 * target at useFrame priority -2 and restores the renderer's state afterwards.
 * Neither took over the final render — R3F still drew the visible frame itself.
 *
 * This one does take it over, because compositing means the frame has to go to
 * a target first and the screen second. A useFrame priority above zero is how
 * R3F is told to stop auto-rendering and hand the loop to a subscriber, so the
 * order for a frame is now:
 *
 *   addEffect        Lenis, the buses, the pointer's velocity
 *   useFrame(-3)     RectSampler refreshes the DOM rects
 *   useFrame(-2)     RefractionPass renders its offscreen targets
 *   useFrame(0)      every mesh reads those rects and writes its uniforms
 *   useFrame(1)      here: capture, simulate, composite, present
 *
 * The two fullscreen passes live in scenes of their own with their own camera,
 * built imperatively rather than mounted as R3F children. That is what makes
 * recursion impossible by construction: the compositor is not in the scene it
 * is compositing, so there is nothing to exclude, no layer to juggle, and no
 * way for a later change to accidentally put it back in.
 *
 * ── What it costs when it is off ────────────────────────────────────────────
 * Nothing. Outside the three sections the strength is exactly zero, and at zero
 * the whole thing short-circuits to a straight render to the screen — no
 * capture, no simulation, no composite. The distortion is an identity transform
 * at zero anyway, so the boundary is invisible.
 *
 * ── What it cannot do ───────────────────────────────────────────────────────
 * DOM text and HTML are not distorted and cannot be: WebGL has no access to
 * them. Everything on the WebGL layer is — the glass word, the arrow, the
 * ground, the sticker field, the card mirrors, the tunnel.
 */

type Props = Partial<FluidConfig> & {
  enabled?: boolean
  /** Renders the raw flow field instead of the scene. Development only. */
  debugFlow?: boolean
}

/** Longest frame the simulation will integrate. A returning tab reports more. */
const MAX_DELTA = 0.05

/** Below this the compositor is an identity transform, so it is skipped. */
const OFF = 0.001

/**
 * Zero flow, in the encoding shaders/flowmap uses.
 *
 * NOT black. The field is signed and packed into 0..1, so the neutral value is
 * the middle of the range — clearing one of these to black leaves it reading as
 * maximum negative velocity in every texel, which on the first frame after a
 * clear displaces the entire frame at once.
 */
const NEUTRAL_FLOW = new THREE.Color(0.5, 0.5, 0)
const scratchColor = new THREE.Color()

function clearFlow(
  renderer: THREE.WebGLRenderer,
  targets: readonly THREE.WebGLRenderTarget[],
) {
  const previousTarget = renderer.getRenderTarget()
  const previousAlpha = renderer.getClearAlpha()
  renderer.getClearColor(scratchColor)

  renderer.setClearColor(NEUTRAL_FLOW, 1)
  for (const target of targets) {
    renderer.setRenderTarget(target)
    renderer.clear()
  }

  renderer.setClearColor(scratchColor, previousAlpha)
  renderer.setRenderTarget(previousTarget)
}

function makeFlowTarget(size: number, type: THREE.TextureDataType) {
  return new THREE.WebGLRenderTarget(size, size, {
    type,
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  })
}

export function FluidDistortion({ enabled = true, debugFlow = false, ...overrides }: Props) {
  const gl = useThree((state) => state.gl)
  const size = useThree((state) => state.size)
  const dpr = useThree((state) => state.viewport.dpr)

  const caps = useSyncExternalStore(
    subscribeToCapabilities,
    getCapabilities,
    getServerCapabilities,
  )
  const config = resolveFluidConfig(overrides, caps.compact)

  /**
   * Everything three.js owns, in one ref.
   *
   * A ref rather than a memo because all of it is mutated every frame, and
   * because the passes have to be disposed on unmount — a memo result is
   * neither mutable nor disposable as far as the compiler is concerned.
   */
  const rig = useRef<{
    sceneTarget: THREE.WebGLRenderTarget
    flow: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget]
    flowScene: THREE.Scene
    flowMaterial: THREE.ShaderMaterial
    composite: THREE.Scene
    compositeMaterial: THREE.ShaderMaterial
    camera: THREE.OrthographicCamera
    read: 0 | 1
    settled: boolean
  } | null>(null)

  useEffect(() => {
    configurePointerVelocity(config.velocitySmoothing, config.idleDecay)
  }, [config.velocitySmoothing, config.idleDecay])

  // Rebuilt on resize, on a DPR change, and when the simulation size changes.
  // Recreated rather than resized in place so there is never a frame sampling a
  // stale attachment.
  useEffect(() => {
    const width = Math.max(1, Math.floor(size.width * dpr))
    const height = Math.max(1, Math.floor(size.height * dpr))

    // Half-float is preferred for the flow — it is a signed field being fed
    // back into itself, and eight bits of it bands visibly after a few dozen
    // frames. Where it is not renderable the encoding in shaders/flowmap makes
    // bytes work unchanged, which is also why there is no second shader here.
    const context = gl.getContext()
    const halfFloat =
      context.getExtension('EXT_color_buffer_float') !== null ||
      context.getExtension('EXT_color_buffer_half_float') !== null
    const type = halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType

    const sceneTarget = new THREE.WebGLRenderTarget(width, height, {
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    })
    // Captured in the colour space it would have reached the screen in, so the
    // compositor can write what it samples and change nothing at zero strength.
    sceneTarget.texture.colorSpace = THREE.SRGBColorSpace

    const flow: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] = [
      makeFlowTarget(config.simulationSize, type),
      makeFlowTarget(config.simulationSize, type),
    ]

    const geometry = new THREE.PlaneGeometry(2, 2)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const flowMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: flowmapFragmentShader,
      uniforms: {
        uPreviousFlow: { value: null as THREE.Texture | null },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uVelocity: { value: new THREE.Vector2() },
        uAspect: { value: 1 },
        uDissipation: { value: config.dissipation },
        uRadius: { value: config.radius },
        uSplatStrength: { value: config.splatStrength },
        uAdvectionStrength: { value: config.advectionStrength },
        uDelta: { value: 1 / 60 },
      },
      depthTest: false,
      depthWrite: false,
    })

    const compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: fluidDistortionFragmentShader,
      uniforms: {
        uSceneTexture: { value: sceneTarget.texture },
        uFlowTexture: { value: flow[0].texture },
        uDistortionStrength: { value: 0 },
        uChromaticAberration: { value: config.chromaticAberration },
      },
      depthTest: false,
      depthWrite: false,
      // The captured frame carries its own alpha; blending it would composite
      // it against the canvas twice.
      blending: THREE.NoBlending,
    })

    const flowScene = new THREE.Scene()
    const flowQuad = new THREE.Mesh(geometry, flowMaterial)
    flowQuad.frustumCulled = false
    flowScene.add(flowQuad)

    const composite = new THREE.Scene()
    const compositeQuad = new THREE.Mesh(geometry, compositeMaterial)
    compositeQuad.frustumCulled = false
    composite.add(compositeQuad)

    // A freshly created target's contents are undefined, and "undefined" in
    // practice means zeros — which this encoding reads as full negative flow.
    clearFlow(gl, flow)

    rig.current = {
      sceneTarget,
      flow,
      flowScene,
      flowMaterial,
      composite,
      compositeMaterial,
      camera,
      read: 0,
      settled: false,
    }

    return () => {
      rig.current = null
      geometry.dispose()
      flowMaterial.dispose()
      compositeMaterial.dispose()
      sceneTarget.dispose()
      flow[0].dispose()
      flow[1].dispose()
    }
  }, [
    gl,
    size.width,
    size.height,
    dpr,
    config.simulationSize,
    config.dissipation,
    config.radius,
    config.splatStrength,
    config.advectionStrength,
    config.chromaticAberration,
  ])

  // Priority 1: R3F stops auto-rendering and this callback owns the frame.
  useFrame((state, delta) => {
    const parts = rig.current
    if (!parts) return

    const { gl: renderer, scene, camera } = state
    const safeDelta = Math.min(delta, MAX_DELTA)

    const strength = enabled && !caps.reducedMotion ? getFluidStrength() : 0

    if (strength <= OFF) {
      // Nothing to composite. Reset the field once so re-entering a section
      // starts from rest rather than from whatever was mid-swirl when it left.
      if (!parts.settled) {
        clearFlow(renderer, parts.flow)
        parts.settled = true
      }
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)
      return
    }
    parts.settled = false

    // 1. The frame, into a target instead of onto the screen.
    renderer.setRenderTarget(parts.sceneTarget)
    renderer.clear()
    renderer.render(scene, camera)

    // 2. One simulation step, read into write, then swap.
    const read = parts.flow[parts.read]
    const write = parts.flow[parts.read === 0 ? 1 : 0]
    const uniforms = parts.flowMaterial.uniforms

    uniforms.uPreviousFlow.value = read.texture
    uniforms.uPointer.value.set(pointerVelocity.current.x, pointerVelocity.current.y)
    uniforms.uVelocity.value.set(
      pointerVelocity.smoothedVelocity.x,
      pointerVelocity.smoothedVelocity.y,
    )
    uniforms.uAspect.value = state.size.width / Math.max(state.size.height, 1)
    uniforms.uDelta.value = safeDelta

    renderer.setRenderTarget(write)
    renderer.render(parts.flowScene, parts.camera)
    parts.read = parts.read === 0 ? 1 : 0

    // 3. The captured frame, pushed around by the field, to the screen.
    const composite = parts.compositeMaterial.uniforms
    composite.uSceneTexture.value = debugFlow ? write.texture : parts.sceneTarget.texture
    composite.uFlowTexture.value = write.texture
    composite.uDistortionStrength.value = debugFlow
      ? 0
      : config.distortionStrength * strength

    renderer.setRenderTarget(null)
    renderer.render(parts.composite, parts.camera)
  }, 1)

  return null
}
