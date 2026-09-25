/** Symmetric entry distance: progress follows the visible part, not time offscreen. */
export function cardEntryProgress(top: number, cardHeight: number, viewportHeight: number) {
  if (cardHeight <= 0 || viewportHeight <= 0) return 0
  const visible = Math.max(0, Math.min(top + cardHeight, viewportHeight) - Math.max(top, 0))
  const travel = Math.min(cardHeight * 0.8, viewportHeight * 0.3)
  return Math.min(visible / travel, 1)
}

export function mobilePreviewTarget(top: number, cardHeight: number, viewportHeight: number) {
  return Math.abs(top + cardHeight / 2 - viewportHeight / 2) < viewportHeight * 0.17
}

/** Loading must not consume the reveal; a late texture still develops visibly. */
export function advanceCardDevelop(previous: number, entry: number, ready: boolean, reducedMotion: boolean, delta: number) {
  if (reducedMotion) return 1
  if (!ready || entry === 0) return 0
  return Math.min(Math.max(previous, entry), previous + Math.min(Math.max(delta, 0), 0.1) / 0.65)
}
