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

/** Rearm on a genuine return after partial exit as well as a full exit. */
export function createCardDevelop() {
  let value = 0
  let peak = 0
  let trough = 1
  let leaving = false
  const reset = () => { value = 0; peak = 0; trough = 1; leaving = false }
  return {
    reset,
    update(entry: number, ready: boolean, reducedMotion: boolean, delta: number) {
      if (!ready || entry === 0) reset()
      if (entry < peak - 0.04) leaving = true
      if (leaving) {
        trough = Math.min(trough, entry)
        if (entry > trough + 0.04) {
          value = 0
          peak = entry
          trough = 1
          leaving = false
        }
      }
      peak = Math.max(peak, entry)
      value = advanceCardDevelop(value, entry, ready, reducedMotion, delta)
      return value
    },
  }
}
