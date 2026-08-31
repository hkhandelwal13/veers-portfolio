'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './DotMatrix.module.css'

/**
 * The dot-matrix wipe — the site's one transition language.
 *
 * A grid of cells, each holding a circle whose radius grows or shrinks with a
 * delay taken from its distance to an origin. Grown, the circles overlap into a
 * solid panel; shrunk, they are gone. CLAUDE.md §5 asks for the same language
 * across the loader, page transitions and the mobile menu, and this is the
 * piece all three share.
 *
 * DOM rather than WebGL, on purpose. All three users sit above the canvas in
 * the stacking order (--z-loader / --z-menu against --z-canvas), so a fullscreen
 * quad could not cover them; and all three have to work on the small screens and
 * reduced-motion settings where the canvas is gated off entirely. The card
 * reveal in shaders/dom-sync.ts is the WebGL half of the same idea.
 *
 * Nothing here runs per frame, and nothing runs on the main thread: each cell
 * is a transform-only CSS animation whose delay is its distance from the
 * origin, so the compositor owns the whole wipe.
 */

/** Cell edge in CSS px. Smaller reads finer and costs more nodes. */
const CELL_DESKTOP = 64
const CELL_MOBILE = 48
const MOBILE_MAX = 640

export type DotMatrixOrigin = 'center' | 'top-right'

const ORIGINS: Record<DotMatrixOrigin, [number, number]> = {
  center: [0.5, 0.5],
  // The mobile menu grows out of its Menu button.
  'top-right': [0.94, 0.06],
}

type Grid = { cols: number; rows: number; distances: number[] }

/**
 * Grid for the current viewport. All three users are fullscreen fixed overlays,
 * so this measures the viewport rather than each element — one listener instead
 * of three ResizeObservers, and no layout read on mount.
 *
 * Returns an empty grid on the server and until mount; the callers each paint
 * their own ground for that first frame.
 */
function useGrid(origin: DotMatrixOrigin): Grid {
  const [size, setSize] = useState<[number, number]>([0, 0])

  useEffect(() => {
    const measure = () => setSize([window.innerWidth, window.innerHeight])
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [])

  return useMemo(() => {
    const [width, height] = size
    if (width === 0 || height === 0) return { cols: 0, rows: 0, distances: [] }

    const cell = width <= MOBILE_MAX ? CELL_MOBILE : CELL_DESKTOP
    const cols = Math.max(1, Math.ceil(width / cell))
    const rows = Math.max(1, Math.ceil(height / cell))
    const [ox, oy] = ORIGINS[origin]

    // Distance is measured in units of cell height, so the wave stays circular
    // on screen instead of stretching to the grid's aspect ratio.
    const aspect = cols / rows
    const distances = new Array<number>(cols * rows)
    let longest = 0

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const dx = ((x + 0.5) / cols - ox) * aspect
        const dy = (y + 0.5) / rows - oy
        const d = Math.hypot(dx, dy)
        distances[y * cols + x] = d
        if (d > longest) longest = d
      }
    }

    for (let i = 0; i < distances.length; i++) distances[i] /= longest || 1

    return { cols, rows, distances }
  }, [size, origin])
}

export function DotMatrix({
  /** true = grown into a solid panel, false = gone. */
  covered,
  origin = 'center',
  /**
   * Uncover by pulling back toward the origin — farthest cells first — instead
   * of opening a hole at it. A menu closing onto its own button wants this; a
   * loader or a route wipe wants the hole.
   */
  retract = false,
  className,
}: {
  covered: boolean
  origin?: DotMatrixOrigin
  retract?: boolean
  className?: string
}) {
  const { cols, rows, distances } = useGrid(origin)

  // Three states, not two: a matrix that has never covered anything must sit
  // still rather than play the uncover, or every mount would flash a full panel
  // and then wipe it away. Adjusted during render — the standard way to derive
  // state from a prop change without the extra paint an effect would cost.
  const [phase, setPhase] = useState<'idle' | 'covered' | 'opening'>(
    covered ? 'covered' : 'idle',
  )
  const [wasCovered, setWasCovered] = useState(covered)
  if (wasCovered !== covered) {
    setWasCovered(covered)
    setPhase(covered ? 'covered' : 'opening')
  }

  return (
    <div
      aria-hidden="true"
      className={[
        styles.matrix,
        phase === 'covered' ? styles.covered : '',
        phase === 'opening' ? styles.opening : '',
        retract ? styles.retract : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {distances.map((d, i) => (
        // Re-rendered only on resize; the animation itself never touches React.
        <span key={i} className={styles.cell} style={{ '--d': d } as React.CSSProperties} />
      ))}
    </div>
  )
}
