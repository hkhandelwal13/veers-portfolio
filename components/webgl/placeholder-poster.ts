import * as THREE from 'three'

/**
 * Placeholder card textures — the two images the dot-matrix reveal blends
 * between (PHASE4_KICKOFF item 1).
 *
 * `poster` is the resting frame: the 45° hatch the CSS drew in Phase 2, moved
 * onto the GPU. `reveal` is what the matrix uncovers: the dark preview panel
 * the wireframe shows on hover.
 *
 * Phase 5 replaces both with real content — the poster from Sanity, and the
 * reveal either with a second image or a muted R2 preview clip as a
 * VideoTexture. Nothing downstream cares which: CardMirror samples two
 * textures and the shader blends them, whatever they are.
 */

const WIDTH = 512
const HEIGHT = Math.round((WIDTH * 9) / 16)

/**
 * Stripe period at texture scale. The CSS fallback draws a 12px period; a
 * 628px-wide desktop card stretches this 512px texture by ~1.23, so 10px here
 * lands at ~12.3px on screen and the two paths read the same. Smaller cards
 * come out finer — exact parity is not worth chasing for a placeholder.
 */
const STRIPE = 10

type Palette = { base: string; stripe: string }

/** Mirrors the CSS tokens; kept here so the two placeholders cannot drift. */
const POSTER: Palette = { base: '#e8e5de', stripe: '#dedad1' }
const REVEAL: Palette = { base: '#232327', stripe: '#2a2a2e' }

let posterTexture: THREE.CanvasTexture | null = null
let revealTexture: THREE.CanvasTexture | null = null

function drawHatch(palette: Palette, angleDown: boolean): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = palette.base
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = palette.stripe
  ctx.lineWidth = STRIPE / 2
  ctx.beginPath()
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += STRIPE) {
    ctx.moveTo(x, 0)
    // The reveal leans the other way, so the swap is legible even between two
    // hatches of similar density.
    ctx.lineTo(angleDown ? x + canvas.height : x - canvas.height, canvas.height)
  }
  ctx.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  // Drawn top-left like every canvas; flipY (the default) turns it the right
  // way up for GL's bottom-left UV origin.
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

export function getPlaceholderPosterTexture(): THREE.CanvasTexture | null {
  posterTexture ??= drawHatch(POSTER, true)
  return posterTexture
}

export function getPlaceholderRevealTexture(): THREE.CanvasTexture | null {
  revealTexture ??= drawHatch(REVEAL, false)
  return revealTexture
}

export function disposePlaceholderTextures() {
  posterTexture?.dispose()
  revealTexture?.dispose()
  posterTexture = null
  revealTexture = null
}
