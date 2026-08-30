import * as THREE from 'three'

/**
 * Placeholder poster texture — the 45° hatch the Phase-2 CSS drew, moved onto
 * the GPU so the mirrored plane has something to show.
 *
 * Phase 5 replaces this with the real poster from Sanity; the mirroring code
 * does not care which texture it samples. Drawn once and shared by every card,
 * since they are all currently identical.
 */

const SIZE = 512
/**
 * Stripe period at texture scale. The CSS fallback draws a 12px period; a
 * 628px-wide desktop card stretches this 512px texture by ~1.23, so 10px here
 * lands at ~12.3px on screen and the two paths read the same. Smaller cards
 * come out finer — exact parity is not worth chasing for a placeholder that
 * Phase 5 replaces with the real poster.
 */
const STRIPE = 10

let cached: THREE.CanvasTexture | null = null

export function getPlaceholderPosterTexture(): THREE.CanvasTexture | null {
  if (cached) return cached
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = Math.round((SIZE * 9) / 16)

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Base — the lighter of the two CSS hatch tones.
  ctx.fillStyle = '#e8e5de'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 45° stripes in the darker tone.
  ctx.save()
  ctx.strokeStyle = '#dedad1'
  ctx.lineWidth = STRIPE / 2
  ctx.beginPath()
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += STRIPE) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x + canvas.height, canvas.height)
  }
  ctx.stroke()
  ctx.restore()

  const texture = new THREE.CanvasTexture(canvas)
  // Drawn top-left like every canvas; flipY (the default) turns it the right
  // way up for GL's bottom-left UV origin.
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false

  cached = texture
  return texture
}

export function disposePlaceholderPosterTexture() {
  cached?.dispose()
  cached = null
}
