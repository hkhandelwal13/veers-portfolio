'use client'

import { useSyncExternalStore } from 'react'
import {
  getScrollSnapshot,
  getServerScrollSnapshot,
  subscribeToScroll,
  type ScrollSnapshot,
} from './scroll-bus'
import {
  getPointerSnapshot,
  getServerPointerSnapshot,
  subscribeToPointer,
  type PointerSnapshot,
} from './pointer-bus'

/**
 * React bindings for the buses.
 *
 * Per-frame code in WebGL should NOT use these — it reads getScrollSnapshot()
 * and the `pointer` object directly inside useFrame, with no subscription and
 * no render. These exist only for the handful of places where scroll or pointer
 * genuinely changes DOM output.
 */

/**
 * The whole scroll snapshot. Re-renders the calling component on every frame
 * that scroll changes, so prefer useScrollFlag where a threshold will do.
 */
export function useScrollSnapshot(): ScrollSnapshot {
  return useSyncExternalStore(subscribeToScroll, getScrollSnapshot, getServerScrollSnapshot)
}

/**
 * Derives a boolean from the scroll snapshot. Because the value is a boolean,
 * React bails out of re-rendering until it actually flips — which is what makes
 * this cheap enough for chrome like the nav.
 *
 * `predicate` is called during render and must be pure.
 */
export function useScrollFlag(predicate: (snapshot: ScrollSnapshot) => boolean): boolean {
  return useSyncExternalStore(
    subscribeToScroll,
    () => predicate(getScrollSnapshot()),
    () => predicate(getServerScrollSnapshot()),
  )
}

/** The pointer snapshot, refreshed at most once per frame. */
export function usePointerSnapshot(): PointerSnapshot {
  return useSyncExternalStore(subscribeToPointer, getPointerSnapshot, getServerPointerSnapshot)
}
