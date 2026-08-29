/**
 * Plain mutable scroll state.
 *
 * The WebGL layer is deliberately imperative (CLAUDE.md §2): per-frame code
 * reads this object and mutates refs directly. Using a React store here would
 * re-render the tree 60x/second, so this stays a bare module singleton — write
 * it from the scroll callback, read it inside useFrame.
 */
export type ScrollState = {
  /** Smoothed scroll offset in px. */
  y: number
  /** Scroll delta of the last frame in px — signed. */
  velocity: number
  /** 0..1 through the whole document. */
  progress: number
  /** Direction of travel: 1 down, -1 up, 0 at rest. */
  direction: number
}

export const scrollState: ScrollState = {
  y: 0,
  velocity: 0,
  progress: 0,
  direction: 0,
}
