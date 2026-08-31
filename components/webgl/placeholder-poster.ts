import * as THREE from 'three'
import { subscribeToTheme } from '@/lib/theme'

/**
 * Placeholder card textures — the two images the dot-matrix reveal blends
 * between (PHASE4_KICKOFF item 1).
 *
 * `poster` is the resting frame: the 45° hatch the CSS drew in Phase 2, moved
 * onto the GPU. `reveal` is what the matrix uncovers: the dark preview panel
 * the wireframe shows on hover.
 *
 * Both palettes are read from the CSS tokens rather than restated here, so the
 * THEME toggle moves the WebGL cards and their CSS fallback together. On a
 * theme change the canvases are repainted *in place* and the textures merely
 * re-uploaded — the THREE.CanvasTexture objects never change identity, so
 * nothing holding them in a uniform has to be told.
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

/**
 * Which tokens each placeholder draws from, with the light theme's values as
 * the fallback for the (server / no-document) case.
 *
 * The poster follows --surface-*, which the theme remaps; the reveal follows
 * --dark-*, which it deliberately does not — the reveal stands in for video,
 * and video is a dark panel in either theme. The dark theme lifts its hatch
 * pair well clear of --dark-surface precisely so the two stay distinguishable.
 */
const POSTER_TOKENS: Palette = { base: '--surface-3', stripe: '--surface-2' }
const REVEAL_TOKENS: Palette = { base: '--dark-surface', stripe: '--dark-surface-2' }
const POSTER_FALLBACK: Palette = { base: '#e8e5de', stripe: '#dedad1' }
const REVEAL_FALLBACK: Palette = { base: '#232327', stripe: '#2a2a2e' }

type Slot = {
  canvas: HTMLCanvasElement
  texture: THREE.CanvasTexture
  tokens: Palette
  fallback: Palette
  /** The reveal leans the other way, so the swap is legible even between two
   *  hatches of similar density. */
  angleDown: boolean
}

let poster: Slot | null = null
let reveal: Slot | null = null
let unsubscribeTheme: (() => void) | null = null

function readPalette(slot: Slot): Palette {
  const styles = getComputedStyle(document.documentElement)
  const base = styles.getPropertyValue(slot.tokens.base).trim()
  const stripe = styles.getPropertyValue(slot.tokens.stripe).trim()
  return {
    base: base || slot.fallback.base,
    stripe: stripe || slot.fallback.stripe,
  }
}

function paint(slot: Slot) {
  const ctx = slot.canvas.getContext('2d')
  if (!ctx) return

  const palette = readPalette(slot)
  const { width, height } = slot.canvas

  ctx.fillStyle = palette.base
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = palette.stripe
  ctx.lineWidth = STRIPE / 2
  ctx.beginPath()
  for (let x = -height; x < width + height; x += STRIPE) {
    ctx.moveTo(x, 0)
    ctx.lineTo(slot.angleDown ? x + height : x - height, height)
  }
  ctx.stroke()

  slot.texture.needsUpdate = true
}

function createSlot(tokens: Palette, fallback: Palette, angleDown: boolean): Slot | null {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT

  const texture = new THREE.CanvasTexture(canvas)
  // Drawn top-left like every canvas; flipY (the default) turns it the right
  // way up for GL's bottom-left UV origin.
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false

  const slot: Slot = { canvas, texture, tokens, fallback, angleDown }
  paint(slot)

  // One subscription for both slots, taken out when the first is built. The
  // textures are module singletons that outlive any component, so this rides
  // along with them and is dropped in dispose().
  unsubscribeTheme ??= subscribeToTheme(() => {
    if (poster) paint(poster)
    if (reveal) paint(reveal)
  })

  return slot
}

export function getPlaceholderPosterTexture(): THREE.CanvasTexture | null {
  poster ??= createSlot(POSTER_TOKENS, POSTER_FALLBACK, true)
  return poster?.texture ?? null
}

export function getPlaceholderRevealTexture(): THREE.CanvasTexture | null {
  reveal ??= createSlot(REVEAL_TOKENS, REVEAL_FALLBACK, false)
  return reveal?.texture ?? null
}

export function disposePlaceholderTextures() {
  poster?.texture.dispose()
  reveal?.texture.dispose()
  poster = null
  reveal = null
  unsubscribeTheme?.()
  unsubscribeTheme = null
}
