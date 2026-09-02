/**
 * Effect shutoff conditions, decided in one place.
 *
 * Haoqi's closing lesson was that the mobile budget and the per-effect shutoff
 * conditions should be set early rather than retrofitted, so every Phase 4
 * effect reads its gate from here instead of sniffing media queries itself.
 *
 * Three inputs drive everything:
 *   reducedMotion  the visitor asked for less movement
 *   hoverCapable   a real pointer that can hover — not a touchscreen
 *   compact        a small viewport, which stands in for the mobile budget
 *
 * These are live: the media queries are watched, so toggling the OS setting or
 * rotating a tablet updates the gates without a reload.
 */

export type Capabilities = {
  reducedMotion: boolean
  hoverCapable: boolean
  compact: boolean
}

const QUERIES = {
  reducedMotion: '(prefers-reduced-motion: reduce)',
  hoverCapable: '(hover: hover) and (pointer: fine)',
  compact: '(max-width: 640px)',
} as const

const SERVER: Capabilities = {
  reducedMotion: false,
  // Assume no hover until proven otherwise: switching an effect ON after
  // hydration is far less jarring than tearing one away.
  hoverCapable: false,
  compact: false,
}

let current: Capabilities = SERVER
const listeners = new Set<() => void>()
let watching = false

function read(): Capabilities {
  return {
    reducedMotion: window.matchMedia(QUERIES.reducedMotion).matches,
    hoverCapable: window.matchMedia(QUERIES.hoverCapable).matches,
    compact: window.matchMedia(QUERIES.compact).matches,
  }
}

function refresh() {
  const next = read()
  if (
    next.reducedMotion === current.reducedMotion &&
    next.hoverCapable === current.hoverCapable &&
    next.compact === current.compact
  ) {
    return
  }
  current = next
  for (const listener of listeners) listener()
}

/** Starts watching. Idempotent; returns a teardown. */
export function watchCapabilities() {
  if (typeof window === 'undefined') return () => {}
  if (watching) return () => {}
  watching = true

  current = read()
  const lists = Object.values(QUERIES).map((query) => window.matchMedia(query))
  for (const list of lists) list.addEventListener('change', refresh)

  return () => {
    for (const list of lists) list.removeEventListener('change', refresh)
    watching = false
  }
}

/** Per-frame safe: no allocation, no subscription. */
export function getCapabilities(): Capabilities {
  return current
}

export function subscribeToCapabilities(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getServerCapabilities(): Capabilities {
  return SERVER
}

/* --------------------------------------------------------------------------
 * Per-effect gates. One named gate per effect, added as each effect lands, so
 * the shutoff rule sits next to the effect's name rather than being re-derived
 * from raw media queries at each call site.
 * ----------------------------------------------------------------------- */

/**
 * Dot-matrix hover reveal on the project cards.
 *
 * Off without a hovering pointer: on a touchscreen the reveal would either
 * never fire or fire once on tap and stick, and the card is a link, so a tap
 * should navigate rather than animate. Reduced motion keeps the reveal — the
 * second image is content — but snaps to it instead of animating (see
 * CardMirror).
 */
export function canAnimateCardReveal(caps: Capabilities = current): boolean {
  return caps.hoverCapable
}

/**
 * Develop-on-enter: cards fade up from a negative as they come into view.
 *
 * Skipped entirely under reduced motion — unlike the hover reveal, nothing is
 * withheld by skipping it, since the end state is the same poster either way.
 * Kept on small screens: it costs one mix in the fragment shader, and the
 * mobile budget's "static posters" is about not playing video, not about
 * refusing a fade.
 */
export function canDevelopOnEnter(caps: Capabilities = current): boolean {
  return !caps.reducedMotion
}

/**
 * Scroll-velocity curl: cards flex slightly with scroll speed.
 *
 * Off under reduced motion — it is motion tied to motion, the most likely of
 * these effects to provoke discomfort. Off on small screens too: touch
 * scrolling is fast and flingy, so the curl reads as wobble rather than
 * momentum, and this is exactly the kind of ornament the mobile budget exists
 * to drop.
 */
export function canCurlOnScroll(caps: Capabilities = current): boolean {
  return !caps.reducedMotion && !caps.compact
}

/**
 * Glass `hello`: two-pass refraction with chromatic dispersion.
 *
 * The expensive one — it renders the scene a second time every frame to give
 * the refraction something to sample. Off on small screens, where that second
 * pass is the difference between a smooth page and a hot phone; the model still
 * renders, just with a cheap opaque material.
 *
 * Kept under reduced motion: refraction is a material, not a movement. What
 * reduced motion switches off is the idle float and the pointer-driven rim
 * light, handled where those are applied.
 */
export function canRenderGlass(caps: Capabilities = current): boolean {
  return !caps.compact
}

/**
 * Floating stickers behind the glass.
 *
 * They exist to give the refraction something with colour and movement to bend;
 * with no glass in front of them they are just confetti, so they follow the
 * glass. Also off under reduced motion — this is continuous ambient movement,
 * the clearest case for honouring that preference.
 */
export function canRenderStickers(caps: Capabilities = current): boolean {
  return canRenderGlass(caps) && !caps.reducedMotion
}

/**
 * Star-6 lens flare post pass.
 *
 * Needs highlights to work on, so it follows the glass too. Off under reduced
 * motion because the rays swing as the rim light moves, which is motion in
 * everything but name.
 */
export function canRenderStarFlare(caps: Capabilities = current): boolean {
  return canRenderGlass(caps) && !caps.reducedMotion
}

/**
 * The custom cursor.
 *
 * Replaces the native pointer, so it needs a real one to replace: a touchscreen
 * has nothing to hide and would get a ring stuck wherever the last tap landed.
 * Off under reduced motion too — the whole effect is lag and deformation, and
 * there is no reduced version of it worth having.
 */
export function canRenderCursor(caps: Capabilities = current): boolean {
  return caps.hoverCapable && !caps.reducedMotion
}
