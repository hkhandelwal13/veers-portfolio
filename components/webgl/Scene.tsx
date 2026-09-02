'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, Environment, Lightformer, Preload } from '@react-three/drei'
import { getHeroProgress } from '@/lib/hero-progress'
import { CONTACT_FIELD_ID, getContactProgress } from '@/lib/contact-progress'
import { CardMirrors } from './CardMirrors'
import { EditorFace } from './EditorFace'
import { DebugSignals } from './DebugSignals'
import { FrameDriver } from './FrameDriver'
import { CONTACT_TARGET_ID, ContactWord } from './ContactWord'
import { SectionField, STAGE_TARGET_ID } from './HeroField'
import { FinaleArrow } from './FinaleArrow'
import { FluidDistortion } from './FluidDistortion'
import { HeroArrow } from './HeroArrow'
import { HeroHello } from './HeroHello'
import { RectSampler } from './RectSampler'
import { RefractionPass } from './RefractionPass'
import { StarFlare } from './StarFlare'
import { Stickers } from './Stickers'

/**
 * The single WebGL stage (CLAUDE.md §2). One fixed, full-screen canvas the whole
 * site shares; DOM sections scroll over it, and the meshes inside follow the
 * rectangles the DOM placeholders define.
 *
 * frameloop="always" because R3F now owns the app's only rAF: <FrameDriver>
 * ticks Lenis and the buses from inside this loop, so pausing it would stop
 * scrolling. Idle cost is one composite of a nearly empty scene; AdaptiveDpr
 * trades resolution rather than frames when the GPU is struggling.
 */
/** Nothing on the closing screen dissolves — it is where the scroll stops. */
const ZERO = () => 0
const FLAT_WIPE: [number, number] = [1, 1]

export default function Scene() {
  return (
    <Canvas
      frameloop="always"
      // Capped below 2: every frame in the fluid sections is now captured to a
      // full-resolution target and composited back, and that pass is paid per
      // device pixel.
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 6], fov: 35, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      // The stage is pointer-events:none so the DOM above stays clickable.
      // Pointer input comes from the PointerBus, not from R3F's raycaster.
      eventSource={document.documentElement}
      eventPrefix="client"
    >
      {/* Order matters: the driver advances scroll and the buses, the sampler
          then refreshes rects at priority -3, and only then do the meshes read
          them at the default priority. */}
      <FrameDriver />
      <RectSampler />
      <DebugSignals />
      {/* Renders the offscreen targets the glass and the flare read. Sits at
          useFrame priority -2, after the rect sampler and before the meshes. */}
      <RefractionPass />
      {/* Takes over the final render — see the note in FluidDistortion. Outside
          Suspense on purpose: it is what presents the frame, so a suspended
          model must not be able to unmount it and leave a blank canvas. */}
      <FluidDistortion />

      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} />
      <directionalLight position={[-4, -1, -3]} intensity={0.8} color="#b8e614" />

      {/* Mirrors need no assets, so they render outside Suspense and are not
          held up by the model download. */}
      <CardMirrors />

      <Suspense fallback={null}>
        {/* Behind the glass and on the content layer, so the refraction pass
            captures them — that is what gives the dispersion something to bend.
            The field is also the first hero reader each frame, so it advances
            the pointer wake the other two sample. */}
        <EditorFace />
        <SectionField targetId={STAGE_TARGET_ID} progress={getHeroProgress} />
        <Stickers />

        {/* The closing screen repeats the hero's arrangement: its own ground,
            its own glass word, its own sticker field. */}
        <SectionField
          targetId={CONTACT_FIELD_ID}
          progress={getContactProgress}
          // Flat: one section's worth of plane, arriving under the finale's
          // last screen. A gradient here is a horizontal edge on the join.
          wipeBias={FLAT_WIPE}
        />
        <ContactWord />
        {/* The hero's stickers break up into the dot grid as you leave it;
            these come back out of the same grid as you arrive, on the closing
            screen's own progress. Nothing shrinks away — this is where the
            scroll stops — so only the dissolve runs. */}
        <Stickers
          fieldId={CONTACT_FIELD_ID}
          slotId={CONTACT_TARGET_ID}
          progress={ZERO}
          dissolve={getContactProgress}
        />
        <HeroHello />
        <HeroArrow />
        <FinaleArrow />
        <StarFlare />

        {/* Procedural environment — built from Lightformers rather than an HDRI
            preset, so nothing is fetched from a CDN at runtime. */}
        <Environment resolution={256}>
          <Lightformer intensity={2} position={[0, 3, 4]} scale={[8, 3, 1]} color="#f4f2ed" />
          <Lightformer intensity={1.4} position={[-4, 0, 2]} scale={[3, 6, 1]} color="#e4f0fa" />
          <Lightformer intensity={1} position={[4, -1, 2]} scale={[3, 6, 1]} color="#b8e614" />
          <Lightformer intensity={0.6} position={[0, -3, -3]} scale={[8, 3, 1]} color="#16205c" />
        </Environment>

        <Preload all />
      </Suspense>

      <AdaptiveDpr pixelated />
    </Canvas>
  )
}
