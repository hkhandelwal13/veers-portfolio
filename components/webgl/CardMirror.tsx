'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { getTargetRect, setTargetMirrorReady } from '@/lib/rect-sampler'
import { getHoverIntent } from '@/lib/hover-bus'
import {
  canCurlOnScroll,
  canDevelopOnEnter,
  getCapabilities,
} from '@/lib/capabilities'
import { getCardAssets } from '@/lib/card-assets'
import { advanceCardDevelop, cardEntryProgress, mobilePreviewTarget } from '@/lib/card-entry'
import { getScrollActivity } from '@/lib/scroll-activity'
import { domSyncFragmentShader, domSyncVertexShader } from '@/shaders/dom-sync'
import { getPosterTexture, releaseCardClips, wantCardClip } from './card-media'
import { getPlaceholderPosterTexture, getPlaceholderRevealTexture } from './placeholder-poster'
import { isRectVisible, rectToUniform } from './rect-space'

/** Dot-matrix cell size in CSS px. */
const CELL_PX = 14
/**
 * Seconds for the wavefront to cross the card.
 *
 * Deliberately a constant-speed sweep rather than exponential damping: damping
 * front-loads the motion and then crawls, so the squares appear to pop near the
 * centre and the growth — the thing worth watching — is over before the eye
 * catches it. Roughly matches --dur-med so the WebGL reveal and the DOM
 * metadata scrim land together.
 */
const REVEAL_SECONDS = 0.45
/** Curl at full scroll speed. Small on purpose — it should read as give, not warp. */
const CURL_MAX = 0.06
const CURL_MAX_RESPONSIVE = 0.12
function createUniforms() {
  return {
    uMap: { value: getPlaceholderPosterTexture() },
    uMapReveal: { value: getPlaceholderRevealTexture() },
    uRect: { value: new THREE.Vector4(0, 0, 0, 0) },
    uOpacity: { value: 1 },
    uRevealProgress: { value: 0 },
    uCellPx: { value: CELL_PX },
    uViewportPx: { value: new THREE.Vector2(1, 1) },
    uPolarity: { value: 1 },
    uCurlStrength: { value: 0 },
  }
}

/**
 * One fullscreen mesh mirroring one DOM card image, with the dot-matrix hover
 * reveal (PHASE4_KICKOFF item 1).
 *
 * A fullscreen quad per card is deliberate — it keeps the coordinate math to a
 * single uniform (see shaders/dom-sync.ts) instead of moving geometry around.
 * The cost is overdraw, which is why anything far outside the viewport stops
 * being drawn at all.
 *
 * Per-frame values are written straight onto the material's own uniforms,
 * reached through the mesh ref. That keeps three.js as the owner of this state
 * rather than a React-held object that merely shares its reference — which is
 * also what keeps it clear of React's immutability rules.
 *
 * Carries three of the Phase 4 card effects: the dot-matrix hover reveal, the
 * develop-on-enter polarity blend, and the scroll-velocity curl.
 *
 * Shutoffs, all present from the start:
 *   offscreen       the mesh is hidden and both progresses reset, so a card
 *                   that scrolls away and comes back replays from the start
 *   touch           the centered card reveals and plays; tapping opens the project
 *   reduced motion  the reveal still happens — the second image is content —
 *                   but snaps; develop and curl are skipped outright
 *   small screen    bounded curl and develop remain enabled
 */
export function CardMirror({ targetId, posterUrl }: { targetId: string; posterUrl?: string }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const progress = useRef(0)
  const develop = useRef(0)
  /** Whether this card currently holds a claim on a clip. */
  const holding = useRef(false)

  const initialUniforms = useMemo(() => createUniforms(), [])

  // Whatever this card was holding open, let go of on unmount — otherwise a
  // route change away from the grid leaves a clip playing to nobody.
  useEffect(() => () => {
    releaseCardClips(targetId)
    setTargetMirrorReady(targetId, false)
  }, [targetId])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const material = mesh.material as THREE.ShaderMaterial
    const uniforms = material.uniforms

    const rect = getTargetRect(targetId)
    // Projection must use the canvas size, including while mobile chrome resizes.
    const height = state.size.height

    // Request the poster a viewport ahead, before its entry animation begins.
    const assets = getCardAssets(targetId)
    const source = posterUrl ?? assets?.poster
    const poster = source && rect && isRectVisible(rect, height, height)
      ? getPosterTexture(source) : null

    // Hide when the texture isn't ready, the rect is invalid, or the card is
    // far offscreen — a fullscreen quad is too expensive to draw for nothing.
    if (!uniforms.uMap.value || !rect || !isRectVisible(rect, height)) {
      mesh.visible = false
      // Reset offscreen so both effects replay on the card's next visit.
      progress.current = 0
      develop.current = 0
      uniforms.uRevealProgress.value = 0
      // And let go of the clip. This branch returns before the frame's normal
      // release, so without it a card that is scrolled away mid-reveal keeps
      // its claim for the life of the page — which on the touch path, where
      // every card that passes the middle of the screen takes one, means the
      // claims only ever accumulate and the budget stops meaning anything.
      if (holding.current) {
        releaseCardClips(targetId)
        holding.current = false
      }
      return
    }

    mesh.visible = true
    rectToUniform(rect, state.size.width, height, uniforms.uRect.value)
    uniforms.uViewportPx.value.set(state.size.width, height)

    const caps = getCapabilities()
    // --- What the card is showing ------------------------------------------
    // The poster replaces the placeholder hatch the moment it has decoded, and
    // not before: swapping to a texture with no image in it would blank the
    // card for the length of the download.
    const posterReady = !source || !!poster
    if (poster) uniforms.uMap.value = poster

    if (posterUrl) {
      mesh.visible = posterReady
      uniforms.uMapReveal.value = uniforms.uMap.value
      setTargetMirrorReady(targetId, posterReady)
    }

    // Restore the mobile in-view shutter. Desktop keeps pointer/focus intent.
    const entry = cardEntryProgress(rect.y, rect.height, height)
    let target = posterUrl || !posterReady ? 0 : caps.hoverCapable
      ? getHoverIntent(targetId)
      : !caps.reducedMotion && develop.current >= 1 && mobilePreviewTarget(rect.y, rect.height, height) ? 1 : 0

    // The clip rolls while the card is chosen *or* still closing over it, so
    // the picture under a retreating reveal is live rather than a frozen frame.
    if (assets?.preview) {
      const wanted = !caps.reducedMotion && (target > 0 || progress.current > 0)
      holding.current = wanted
      const clip = wantCardClip(assets.preview, targetId, wanted)
      // Until the clip has a frame, reveal the poster — which is to say,
      // reveal nothing. The placeholder panel that used to stand in here is an
      // abstract hatch, so a card whose video had not arrived yet swapped its
      // photograph for a blue rectangle and called it a preview. Opening onto
      // the same image is the honest empty state: the dot grid still runs, and
      // the picture changes the moment there is a picture to change to.
      uniforms.uMapReveal.value = clip ?? uniforms.uMap.value
      // Wait for an actual video frame so the shutter cannot finish over an
      // identical poster while a cold mobile video request is still loading.
      if (!clip) target = 0
    }

    if (caps.reducedMotion) {
      progress.current = target
    } else {
      // Constant rate, so the wavefront crosses the card at a steady speed and
      // arrives exactly — no asymptote left hanging at 0.999...
      const step = (delta / REVEAL_SECONDS) * Math.sign(target - progress.current)
      progress.current =
        Math.abs(target - progress.current) <= Math.abs(step)
          ? target
          : THREE.MathUtils.clamp(progress.current + step, 0, 1)
    }

    uniforms.uRevealProgress.value = progress.current

    // Develop as the poster enters from either edge. Retain the completed
    // image while it leaves, and re-arm only after it is entirely offscreen.
    develop.current = advanceCardDevelop(develop.current, entry, posterReady, !canDevelopOnEnter(caps), delta)
    uniforms.uPolarity.value = develop.current

    // --- Scroll-velocity curl -----------------------------------------------
    const responsiveCurl = caps.stacked || !caps.hoverCapable
    const activity = getScrollActivity()
    uniforms.uCurlStrength.value = canCurlOnScroll(caps)
      ? responsiveCurl
        ? CURL_MAX_RESPONSIVE * activity
        : CURL_MAX * activity
      : 0
  }, -2.5)

  return (
    <mesh
      ref={meshRef}
      // The quad ignores the camera, so frustum culling would be meaningless
      // and occasionally wrong.
      frustumCulled={false}
      /*
       * Above the sticker field, which is the other thing on the content layer.
       *
       * This quad has depthTest off — it is screen-space, so there is no depth
       * to test against — which leaves render order as the only thing deciding
       * what covers what. At -1 it drew before the stickers and they painted
       * straight over the posters: through about and work they are dissolved
       * into the dot grid, so what landed on every card was a field of dots.
       *
       * A card is the page's content and the field is its background, so the
       * card wins. It only paints inside its own rect — everything outside is
       * masked to zero alpha — so the field is untouched around it.
       */
      renderOrder={1}
      visible={false}
    >
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={domSyncVertexShader}
        fragmentShader={domSyncFragmentShader}
        uniforms={initialUniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}
