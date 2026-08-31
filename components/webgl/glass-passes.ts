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
  /** Content *and* the word — what the cursor lens refracts, so it bends both. */
  lensScene: THREE.WebGLRenderTarget | null
  /** Only the glass, half res — the flare's highlight source. */
  glassOnly: THREE.WebGLRenderTarget | null
  /** The finished six-ray streaks, half res. */
  star: THREE.WebGLRenderTarget | null
  /** False while the cursor lens is not being drawn, so its pass can stop. */
  lensVisible: boolean
  /** False while the glass is offscreen, so the flare can stop entirely. */
  glassVisible: boolean
  /** The glass material, so the flare pass can switch it to highlight-only. */
  glassMaterial: THREE.ShaderMaterial | null
} = {
  refraction: null,
  lensScene: null,
  glassOnly: null,
  star: null,
  lensVisible: false,
  glassVisible: false,
  glassMaterial: null,
}
