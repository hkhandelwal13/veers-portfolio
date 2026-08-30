/**
 * Hover intent per WebGL target.
 *
 * The card lives in the DOM and its reveal is drawn by WebGL, so the two need
 * to agree on whether a card is hovered. Routing that through React state would
 * re-render the grid on every pointer cross; this is a plain map the DOM writes
 * and useFrame reads, in the same spirit as the scroll and pointer buses.
 *
 * Stores intent (0 or 1), not progress — the easing lives with the effect, so
 * each one can settle at its own rate.
 */

const intents = new Map<string, number>()

/** `active` covers hover and keyboard focus alike; a card must reveal for both. */
export function setHoverIntent(id: string, active: boolean) {
  intents.set(id, active ? 1 : 0)
}

export function getHoverIntent(id: string): number {
  return intents.get(id) ?? 0
}

export function clearHoverIntent(id: string) {
  intents.delete(id)
}

/** Test seam. */
export function resetHoverBus() {
  intents.clear()
}
