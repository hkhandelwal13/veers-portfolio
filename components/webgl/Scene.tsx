'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, Environment, Lightformer, Preload } from '@react-three/drei'
import { HeroHello } from './HeroHello'

/**
 * The single WebGL stage (CLAUDE.md §2). One fixed, full-screen canvas that the
 * whole site shares; DOM sections scroll over it and, from Phase 3, synced
 * planes will be positioned from each element's getBoundingClientRect().
 *
 * frameloop="never" is deliberate: this canvas has no rAF of its own.
 * <SmoothScrollProvider> advances it once per frame, after Lenis has updated
 * scroll, so WebGL is always in step with the DOM.
 */
export default function Scene() {
  return (
    <Canvas
      frameloop="never"
      dpr={[1, 2]}
      camera={{ position: [0, 0, 6], fov: 35, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      // The stage is pointer-events:none so the DOM above stays clickable.
      // Listening on the document keeps pointer parallax alive anyway.
      eventSource={document.documentElement}
      eventPrefix="client"
    >
      {/* Key light + fill. The baked water material is a MeshStandardMaterial,
          so it needs an environment to read as anything but flat. */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} />
      <directionalLight position={[-4, -1, -3]} intensity={0.8} color="#35d2e0" />

      <Suspense fallback={null}>
        <HeroHello />

        {/* Procedural environment — built from Lightformers rather than an HDRI
            preset, so nothing is fetched from a CDN at runtime. */}
        <Environment resolution={256}>
          <Lightformer intensity={2} position={[0, 3, 4]} scale={[8, 3, 1]} color="#eaf4ff" />
          <Lightformer intensity={1.4} position={[-4, 0, 2]} scale={[3, 6, 1]} color="#35d2e0" />
          <Lightformer intensity={1} position={[4, -1, 2]} scale={[3, 6, 1]} color="#ff7a3d" />
          <Lightformer intensity={0.6} position={[0, -3, -3]} scale={[8, 3, 1]} color="#0d111b" />
        </Environment>

        <Preload all />
      </Suspense>

      {/* Drops resolution instead of frames when the GPU is struggling. */}
      <AdaptiveDpr pixelated />
    </Canvas>
  )
}
