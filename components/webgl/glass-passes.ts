import type * as THREE from 'three'

/**
 * Offscreen targets shared between the passes and the materials that read them.
 *
 * The glass material needs the refraction render target, and the flare
 * composite needs the star target, but neither renders them — RefractionPass
 * does, earlier in the same frame. Passing them through React context would
 * mean a re-render whenever a target is recreated on resize; this is a plain
 * module the pass writes and the materials read inside useFrame.
 */
export const glassPasses: {
  /** The scene minus the glass — what the refraction samples. */
  refraction: THREE.WebGLRenderTarget | null
  /** Only the glass, half res — the flare's highlight source. */
  glassOnly: THREE.WebGLRenderTarget | null
  /** The finished six-ray streaks, half res. */
  star: THREE.WebGLRenderTarget | null
  /** False while the glass is offscreen, so the flare can stop entirely. */
  glassVisible: boolean
} = {
  refraction: null,
  glassOnly: null,
  star: null,
  glassVisible: false,
}
