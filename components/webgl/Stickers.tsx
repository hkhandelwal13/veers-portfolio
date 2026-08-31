'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { canRenderStickers, getCapabilities } from '@/lib/capabilities'
import {
  insetUvRect,
  loadStickerAtlas,
  STICKER_ATLAS_URL,
  type StickerAtlas,
} from '@/lib/sticker-atlas'
import { getTargetRect } from '@/lib/rect-sampler'
import { getHeroObjectDissolve, getHeroProgress } from '@/lib/hero-progress'
import { getScrollSnapshot } from '@/lib/scroll-bus'
import { stickerFragmentShader, stickerVertexShader } from '@/shaders/stickers'
import { FIELD_TARGET_ID } from './HeroField'
import { HERO_TARGET_ID } from './HeroHello'
import { LAYER_CONTENT } from './layers'
import { rectToWorld } from './rect-space'

/** Fixed budget — the count never grows with content. */
const INSTANCE_BUDGET = 15
/**
 * How far behind the glass they sit, in world units.
 *
 * Far enough that the word's own depth cannot poke through them — the model is
 * a thick tube, not a flat sheet, so a small offset leaves stickers punching
 * through the letterforms. Perspective shrinkage at this distance is
 * compensated for per particle below.
 */
const Z_OFFSET = -4.5
/** Seconds for one fall, top to bottom of the band. */
const FALL_SECONDS = 17

/** Height of the field they fall through, as a multiple of the hero section. */
const SPREAD_Y = 1.25

type Particle = {
  sticker: number
  /** 0..1 down the field; wraps independently of every other particle. */
  progress: number
  speed: number
  /** 0..1 across the field. Drifts as it falls, and wraps on its own. */
  lane: number
  /** Sideways travel per fall, signed — the reason no two paths are parallel. */
  drift: number
  /** Phase and rate of the sway laid over that drift. */
  swayPhase: number
  swayRate: number
  swayAmount: number
  z: number
  scale: number
  rotation: number
  spin: number
}

/**
 * Stickers falling behind the glass (PHASE4_KICKOFF item 5).
 *
 * Their job is to give the refraction something worth bending. Clear glass over
 * a flat page barely reads as glass at all — it is moving colour behind it that
 * makes the dispersion and distortion legible. So they sit at a small negative
 * z offset, behind the word and on the content layer, which is exactly what the
 * refraction pass captures.
 *
 * One InstancedMesh, one atlas, one draw call. Positions are CPU-driven within
 * a fixed budget, so the cost is known regardless of how many sticker images
 * the set ends up containing.
 */
export function Stickers() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const [atlas, setAtlas] = useState<StickerAtlas | null>(null)
  // Both carry state across frames, so neither can be a memo result.
  const particlesRef = useRef<Particle[]>([])
  const dummyRef = useRef(new THREE.Object3D())

  // Configured through the load callback rather than afterwards: the texture is
  // owned by the hook, and this is where that setup belongs.
  const texture = useTexture(STICKER_ATLAS_URL, (loaded) => {
    const atlasTexture = Array.isArray(loaded) ? loaded[0] : loaded
    atlasTexture.colorSpace = THREE.SRGBColorSpace
    atlasTexture.minFilter = THREE.LinearFilter
    atlasTexture.magFilter = THREE.LinearFilter
    atlasTexture.generateMipmaps = false
  })

  useEffect(() => {
    const controller = new AbortController()
    loadStickerAtlas(controller.signal).then(setAtlas)
    return () => controller.abort()
  }, [])

  const uniforms = useMemo(
    () => ({
      uAtlas: { value: texture },
      uFade: { value: 1 },
      uDissolve: { value: 0 },
      uDotPx: { value: 7 },
      uPixelRatio: { value: 1 },
    }),
    [texture],
  )

  // Deterministic layout: a fixed seed sequence rather than Math.random, so the
  // arrangement is the same on every load and a screenshot means something.
  useEffect(() => {
    if (!atlas) {
      particlesRef.current = []
      return
    }
    let seed = 20260830
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    particlesRef.current = Array.from({ length: INSTANCE_BUDGET }, (_, i) => ({
      sticker: i % atlas.stickers.length,
      // Independent on every axis. Sharing a fall rate, or a fixed column,
      // is what made them read as one group moving together rather than as a
      // field: the eye picks up the common motion long before the positions.
      progress: random(),
      speed: 0.5 + random() * 0.7,
      lane: random(),
      drift: (random() - 0.5) * 0.55,
      swayPhase: random() * Math.PI * 2,
      swayRate: 0.25 + random() * 0.55,
      swayAmount: 0.02 + random() * 0.06,
      z: Z_OFFSET - random() * 1.6,
      scale: 0.075 + random() * 0.075,
      rotation: random() * Math.PI * 2,
      spin: (random() - 0.5) * 0.5,
    }))
  }, [atlas])

  // Per-instance atlas slices, uploaded once.
  useEffect(() => {
    const mesh = meshRef.current
    const particles = particlesRef.current
    if (!mesh || !atlas || particles.length === 0) return

    const uvRects = new Float32Array(INSTANCE_BUDGET * 4)
    const opacities = new Float32Array(INSTANCE_BUDGET)

    particles.forEach((particle, i) => {
      const entry = atlas.stickers[particle.sticker]
      const rect = insetUvRect(entry.uvRect, atlas.width, atlas.height)
      uvRects.set(rect, i * 4)
      opacities[i] = 1
    })

    mesh.geometry.setAttribute('aUvRect', new THREE.InstancedBufferAttribute(uvRects, 4))
    mesh.geometry.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(opacities, 1))
    mesh.layers.set(LAYER_CONTENT)
  }, [atlas])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    const particles = particlesRef.current
    const dummy = dummyRef.current
    if (!mesh || !atlas || particles.length === 0) return

    if (!canRenderStickers(getCapabilities())) {
      mesh.visible = false
      return
    }

    // The whole hero section, not the word's slot: they are a field the hero
    // sits in, and a field measured against a half-width rect only ever covers
    // half the screen.
    const rect = getTargetRect(FIELD_TARGET_ID)
    const slot = getTargetRect(HERO_TARGET_ID)
    const { viewportHeight } = getScrollSnapshot()
    const height = viewportHeight || state.size.height
    if (!rect || !rect.valid || !slot || !slot.valid) {
      mesh.visible = false
      return
    }

    const camera = state.camera as THREE.PerspectiveCamera
    const seat = rectToWorld(rect, camera, state.size.width, height)
    const bandHeight = rect.height * seat.unitsPerPixel * SPREAD_Y
    const bandWidth = rect.width * seat.unitsPerPixel
    // Size still keys off the word's slot, so a sticker stays the same size
    // relative to the word whatever the section's own height happens to be.
    const sizeBase = slot.width * seat.unitsPerPixel

    if (Math.abs(seat.y) > bandHeight * 3) {
      mesh.visible = false
      return
    }
    mesh.visible = true

    // --- Hero exit -----------------------------------------------------------
    // Shrink and fade together, then dissolve into the same dot grid the
    // background and the glass use.
    const progress = getHeroProgress()
    const material = mesh.material as THREE.ShaderMaterial
    material.uniforms.uFade.value = 1 - progress * 0.85
    material.uniforms.uDissolve.value = getHeroObjectDissolve()
    material.uniforms.uPixelRatio.value = state.viewport.dpr
    const exitScale = 1 - 0.55 * progress

    const step = delta / FALL_SECONDS
    const time = state.clock.elapsedTime
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i]
      const advance = step * particle.speed
      particle.progress = (particle.progress + advance) % 1
      // Horizontal travel is tied to the fall, so a slow sticker drifts slowly
      // — the two axes belong to the same journey rather than running on
      // separate clocks.
      particle.lane = (particle.lane + advance * particle.drift + 1) % 1
      particle.rotation += particle.spin * delta

      // Sitting behind the glass means perspective shrinks them. Scaling by
      // the ratio of distances keeps their apparent size — and the width of the
      // band they fall through — the same as if they were at the word's depth.
      const depthScale = (camera.position.z - particle.z) / Math.max(camera.position.z, 0.001)

      const sway = Math.sin(time * particle.swayRate + particle.swayPhase) * particle.swayAmount
      dummy.position.set(
        seat.x + (particle.lane - 0.5 + sway) * bandWidth * depthScale,
        seat.y + (bandHeight * 0.5 - particle.progress * bandHeight) * depthScale,
        particle.z,
      )
      dummy.rotation.set(0, 0, particle.rotation)
      const size = particle.scale * sizeBase * depthScale * exitScale
      const aspect = atlas.stickers[particle.sticker].aspect
      dummy.scale.set(size * aspect, size, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, INSTANCE_BUDGET]}
      frustumCulled={false}
      visible={false}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={stickerVertexShader}
        fragmentShader={stickerFragmentShader}
        uniforms={uniforms}
        transparent
        // Tested against the glass so anything behind it is occluded rather
        // than drawn over it, but not written, so stickers do not occlude each
        // other in the wrong order.
        depthTest
        depthWrite={false}
      />
    </instancedMesh>
  )
}
