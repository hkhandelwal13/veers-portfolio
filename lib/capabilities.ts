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
 *   stacked        narrow enough that the layout is one column, so a reserved
 *                  3D slot spans the whole of it rather than part of it
 *
 * These are live: the media queries are watched, so toggling the OS setting or
 * rotating a tablet updates the gates without a reload.
 */

export type Capabilities = {
  reducedMotion: boolean
  hoverCapable: boolean
  compact: boolean
  stacked: boolean
}

const QUERIES = {
  reducedMotion: '(prefers-reduced-motion: reduce)',
  hoverCapable: '(hover: hover) and (pointer: fine)',
  compact: '(max-width: 640px)',
  // The same line the CSS stacks at — see Hero.module.css.
  stacked: '(max-width: 1024px)',
} as const

const SERVER: Capabilities = {
  reducedMotion: false,
  // Assume no hover until proven otherwise: switching an effect ON after
  // hydration is far less jarring than tearing one away.
  hoverCapable: false,
  compact: false,
  stacked: false,
}

let current: Capabilities = SERVER
const listeners = new Set<() => void>()
let watching = false

function read(): Capabilities {
  return {
    reducedMotion: window.matchMedia(QUERIES.reducedMotion).matches,
    hoverCapable: window.matchMedia(QUERIES.hoverCapable).matches,
    compact: window.matchMedia(QUERIES.compact).matches,
    stacked: window.matchMedia(QUERIES.stacked).matches,
  }
}

function refresh() {
  const next = read()
  if (
    next.reducedMotion === current.reducedMotion &&
    next.hoverCapable === current.hoverCapable &&
    next.compact === current.compact &&
    next.stacked === current.stacked
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
 * Card previews play when the card reaches the middle of the screen.
 *
 * The touch counterpart to the hover reveal, not an addition to it: without a
 * pointer there is no hover to start the clip, and a tap has to follow the
 * link rather than animate. Scroll position is the only intent a touchscreen
 * offers, so the card you have brought to the middle of the screen is the one
 * treated as chosen.
 *
 * Off under reduced motion, where the poster is the whole of the card.
 */
export function canPlayCardPreviewInView(caps: Capabilities = current): boolean {
  return !caps.hoverCapable && !caps.reducedMotion
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
 * these effects to provoke discomfort. On everywhere else: it is one mix in a
 * fragment shader the card is already running, and a phone that scrolls fast
 * is exactly where a velocity effect has something to say.
 */
export function canCurlOnScroll(caps: Capabilities = current): boolean {
  return !caps.reducedMotion
}

/**
 * Glass `hello`: two-pass refraction with chromatic dispersion.
 *
 * The expensive one — it renders the scene a second time every frame to give
 * the refraction something to sample. It used to be off below 640px, and what
 * that bought was a phone looking at a flat blue slab where the desktop has
 * the site's whole subject: the hero, the arrow and the closing word are all
 * this material.
 *
 * On now, everywhere, with the cost taken out of the resolution instead of out
 * of the effect — the refraction target is rendered at a fraction of the
 * screen on a small one (see RefractionPass). The second pass is fill-rate
 * bound, so a target at 55% of the pixels is roughly a third of the work, and
 * a refraction is a blurred, displaced read of the scene: it is the one thing
 * in the frame that can lose resolution without anyone being able to tell.
 *
 * Kept under reduced motion: refraction is a material, not a movement. What
 * reduced motion switches off is the idle float and the pointer-driven rim
 * light, handled where those are applied.
 */
export function canRenderGlass(): boolean {
  return true
}

/**
 * Floating stickers behind the glass.
 *
 * One instanced mesh and one draw call for the whole field, which is why the
 * phone keeps it: the field is the page's ambient life, and dropping it left
 * mobile with an empty ground. Off under reduced motion — this is continuous
 * ambient movement, the clearest case for honouring that preference.
 */
export function canRenderStickers(caps: Capabilities = current): boolean {
  return !caps.reducedMotion
}

/**
 * Star-6 lens flare post pass.
 *
 * Needs highlights to work on, so it follows the glass too. Off under reduced
 * motion because the rays swing as the rim light moves, which is motion in
 * everything but name.
 */
export function canRenderStarFlare(caps: Capabilities = current): boolean {
  return canRenderGlass() && !caps.reducedMotion
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
