import * as THREE from 'three'

/**
 * Textures for the project cards: the poster each one rests on, and the clip
 * the hover reveal uncovers.
 *
 * Keyed by URL rather than by card, which matters in both directions. Two cards
 * sharing a file — which is exactly the state of the grid before all eight
 * projects have their own footage — share one decode, one texture and one
 * `<video>`; and once they have separate files, each gets its own without any
 * of this changing.
 *
 * Nothing here is fetched until it is asked for. A poster loads when its card
 * first renders; a clip's `<video>` is created on the first hover and carries
 * `preload="none"` until then, so eight projects cost eight small images on
 * arrival and not a byte of video.
 */

/**
 * How many clips may be rolling at once.
 *
 * A hovering pointer only ever wants one, but the touch path plays whatever is
 * in the middle of the screen, and a fast scroll can put two cards through that
 * band before the first has been let go. Three is enough headroom for that
 * without ever having eight decoders alive.
 */
const MAX_PLAYING = 3

/* ------------------------------------------------------------------ posters */

const posters = new Map<string, THREE.Texture>()
let loader: THREE.TextureLoader | null = null

/**
 * The poster for a card, or null until it has decoded.
 *
 * Null rather than a placeholder so the caller decides what to show in the
 * meantime — CardMirror keeps the hatch it was already drawing, which means a
 * card never flashes empty while its image arrives.
 */
export function getPosterTexture(url: string): THREE.Texture | null {
  const existing = posters.get(url)
  if (existing) return existing.image ? existing : null

  if (typeof window === 'undefined') return null
  loader ??= new THREE.TextureLoader()

  const texture = loader.load(url)
  // The file is sRGB (see the delivery spec); saying so is what keeps the card
  // the same colour as the rest of the page rather than washed out.
  texture.colorSpace = THREE.SRGBColorSpace
  // The curl samples inward, never past the edge — but a clamp costs nothing
  // and means a future effect that does reach outside cannot wrap the image.
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  // Mipmaps left on: a 1672px poster drawn into a 628px card is a heavy
  // minification, and without them the still crawls with aliasing as it moves.
  texture.anisotropy = 4
  posters.set(url, texture)
  return null
}

/* ------------------------------------------------------------------- clips */

type Clip = {
  video: HTMLVideoElement
  texture: THREE.VideoTexture
  /** Cards currently asking for it. Playback follows whether this is empty. */
  wanters: Set<string>
  /** When it was last asked for, so the budget can drop the stalest. */
  touched: number
  /** Why the last play() was refused, for the dev readout. */
  lastError?: string
}

const clips = new Map<string, Clip>()

function ensureClip(url: string): Clip | null {
  const existing = clips.get(url)
  if (existing) return existing
  if (typeof document === 'undefined') return null

  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.loop = true
  video.playsInline = true
  video.preload = 'none'
  // Set for the move to R2: a cross-origin video without this taints the
  // canvas and the texture upload fails outright. Harmless while same-origin.
  video.crossOrigin = 'anonymous'

  /*
   * In the document, but a pixel of it, transparent.
   *
   * Both halves of that are load-bearing, and both were found by measuring
   * rather than by reasoning. Detached, the element accepts play() and reports
   * itself playing while readyState never leaves 0 — it is never asked to
   * fetch anything, so the card reveals a blank. And `display: none` is not
   * the way to hide it either: a media element with no box is not guaranteed
   * to produce frames, which is the one thing this element exists to do.
   *
   * So it is laid out, and hidden by being transparent and one pixel across.
   * Out of the tab order and out of the accessibility tree, since the picture
   * reaches the page as a texture and the <video> itself is plumbing.
   */
  video.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1'
  video.setAttribute('aria-hidden', 'true')
  video.tabIndex = -1
  document.body.appendChild(video)

  const texture = new THREE.VideoTexture(video)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  // A video texture is re-uploaded every frame it changes, so mipmaps would be
  // rebuilt every frame too. Linear without them is the standard trade.
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false

  const clip: Clip = { video, texture, wanters: new Set(), touched: 0 }
  clips.set(url, clip)
  return clip
}

/** Pauses whatever has been wanted least recently, down to the budget. */
function enforceBudget() {
  const playing = [...clips.values()].filter((clip) => clip.wanters.size > 0)
  if (playing.length <= MAX_PLAYING) return
  playing
    .sort((a, b) => a.touched - b.touched)
    .slice(0, playing.length - MAX_PLAYING)
    .forEach((clip) => clip.video.pause())
}

/**
 * Says whether a card wants a clip rolling, and hands back its texture.
 *
 * Reconciled on the spot rather than gathered and committed once a frame:
 * wanting changes when a pointer crosses a card, which is rare, so there is
 * nothing to batch.
 *
 * Returns null until the clip has a frame to show. Handing back an empty video
 * texture would draw a black card for the first moments of every first hover —
 * the exact moment the effect is being judged.
 */
export function wantCardClip(url: string, cardId: string, wanted: boolean): THREE.VideoTexture | null {
  const clip = ensureClip(url)
  if (!clip) return null

  const had = clip.wanters.size > 0
  if (wanted) {
    clip.wanters.add(cardId)
    clip.touched = performance.now()
  } else {
    clip.wanters.delete(cardId)
  }

  const wants = clip.wanters.size > 0
  if (wants !== had) {
    if (wants) {
      // preload="none" means nothing has been fetched yet, and play() alone is
      // not a reliable trigger for the resource selection algorithm. Asking
      // explicitly is.
      if (clip.video.networkState === HTMLMediaElement.NETWORK_EMPTY) clip.video.load()
      void clip.video.play().catch((error: unknown) => {
        // Autoplay refused, or the file failed. Either way the card keeps its
        // poster, which is a correct resting state rather than an error one.
        clip.lastError = String(error).slice(0, 120)
      })
      enforceBudget()
    } else {
      // Paused, not rewound: a loop picked up where it left off costs nothing
      // and avoids a re-buffer every time the pointer crosses back.
      clip.video.pause()
    }
  }

  return clip.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? clip.texture : null
}

/** Drops a card's claim on every clip — for unmount, where no URL is at hand. */
export function releaseCardClips(cardId: string) {
  for (const clip of clips.values()) {
    if (!clip.wanters.delete(cardId)) continue
    if (clip.wanters.size === 0) clip.video.pause()
  }
}

/**
 * Dev-only readout.
 *
 * The `<video>` elements are deliberately never in the document, so nothing
 * about this is visible to a DOM query — the only honest way to check that a
 * hover actually rolled a clip is to ask the clip. Stripped from production
 * builds by the constant condition.
 */
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __cardClips?: () => unknown }).__cardClips = () =>
    [...clips.entries()].map(([url, clip]) => ({
      url: url.slice(url.lastIndexOf('/') + 1),
      wanters: [...clip.wanters],
      playing: !clip.video.paused,
      readyState: clip.video.readyState,
      networkState: clip.video.networkState,
      mediaError: clip.video.error ? `${clip.video.error.code}: ${clip.video.error.message}` : null,
      lastError: clip.lastError ?? null,
      inDoc: clip.video.isConnected,
      t: +clip.video.currentTime.toFixed(2),
      size: `${clip.video.videoWidth}x${clip.video.videoHeight}`,
    }))
}

/** Test seam. */
export function resetCardMedia() {
  for (const clip of clips.values()) {
    clip.video.pause()
    clip.video.removeAttribute('src')
    clip.texture.dispose()
  }
  clips.clear()
  for (const texture of posters.values()) texture.dispose()
  posters.clear()
}
