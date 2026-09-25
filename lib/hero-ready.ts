/** Signals the first rendered hello frame, not merely a completed download. */
let ready = false
const listeners = new Set<() => void>()
export function isHeroReady() { return ready }
export function markHeroReady() {
  if (ready) return
  ready = true
  for (const listener of listeners) listener()
}
export function subscribeToHeroReady(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
