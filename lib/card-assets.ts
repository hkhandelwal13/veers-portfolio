/**
 * Which images and clips belong to which card.
 *
 * The card lives in the DOM and its pictures are drawn by WebGL, so the two
 * sides need to agree on more than a rectangle: the mirror has to know which
 * poster to sample and which clip to roll under the reveal. That could have
 * been threaded through React, but the mirrors are rendered from a subscription
 * to *registration* changes (see CardMirrors) precisely so that scrolling and
 * hovering never re-render the canvas tree — passing assets as props would put
 * the grid's data back on that path.
 *
 * So it is a plain map the DOM writes on mount and useFrame reads, in the same
 * spirit as the hover, scroll and pointer buses. Registration is the same
 * lifecycle as the rect target's, which is what keeps the two in step.
 */

export type CardAssets = {
  /** The card at rest. Always present — it is what the reveal opens *from*. */
  poster: string
  /** The clip the reveal uncovers. Absent on a project with no preview yet. */
  preview?: string
}

const assets = new Map<string, CardAssets>()

export function registerCardAssets(id: string, value: CardAssets): () => void {
  assets.set(id, value)
  return () => {
    // Only clear if this registration is still the current one: a route change
    // can mount the next card before the previous one's cleanup runs.
    if (assets.get(id) === value) assets.delete(id)
  }
}

export function getCardAssets(id: string): CardAssets | undefined {
  return assets.get(id)
}

/** Test seam. */
export function resetCardAssets() {
  assets.clear()
}
