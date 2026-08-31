/**
 * Is a fullscreen wipe currently covering the page?
 *
 * The loader and the route transition both paint over everything. Anything that
 * plays once on arrival — the text decode, most obviously — has to wait for
 * them, or it runs behind the curtain and the reader arrives after the show.
 *
 * A set rather than a boolean because the two sources are independent and can
 * overlap: a link clicked from the mobile menu closes the menu while the route
 * panel is already covering.
 */

const covering = new Set<string>()
const listeners = new Set<() => void>()

/** @param id a stable name per source — 'loader', 'route'. */
export function setCurtain(id: string, isCovering: boolean) {
  const before = covering.size
  if (isCovering) covering.add(id)
  else covering.delete(id)

  // Only the empty/non-empty transition matters to anyone listening.
  if ((before === 0) !== (covering.size === 0)) {
    for (const listener of listeners) listener()
  }
}

export function isCurtainOpen(): boolean {
  return covering.size === 0
}

export function subscribeToCurtain(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
