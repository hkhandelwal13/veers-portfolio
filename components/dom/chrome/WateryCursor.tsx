'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import {
  canRenderCursor,
  canRenderGlass,
  getCapabilities,
  getServerCapabilities,
  subscribeToCapabilities,
} from '@/lib/capabilities'
import { onFrame } from '@/lib/frame-loop'
import { pointer, pointerRaw } from '@/lib/pointer-bus'
import styles from './WateryCursor.module.css'

/**
 * The cursor, as a bead of water.
 *
 * Two parts, because a lagging cursor you cannot aim with is a broken cursor:
 * a hard dot pinned to the real pointer position, and a lens that trails it and
 * stretches along its direction of travel. The dot is what you click with; the
 * lens is the effect.
 *
 * Driven from the shared frame loop, not its own rAF (CLAUDE.md §11) — and from
 * lib/frame-loop's DOM list rather than R3F's useFrame, because it has to keep
 * working on a page where the canvas never mounts.
 *
 * Gated on canRenderCursor: hover-capable pointers only, never under reduced
 * motion. Where it is off, the native cursor is untouched — the class that
 * hides it is only ever added by this component.
 */

/** How hard the lens chases the dot. Lower is wetter. */
const LENS_LAMBDA = 11
/** Distance, in px, at which the lens reaches full stretch. */
const STRETCH_SCALE = 190
const STRETCH_MAX = 0.42

/** What counts as something you can act on, for the widened state. */
const INTERACTIVE = 'a[href], button, [role="button"], input, textarea, select, summary'

export function WateryCursor() {
  const lensRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)

  const caps = useSyncExternalStore(
    subscribeToCapabilities,
    getCapabilities,
    getServerCapabilities,
  )
  const enabled = canRenderCursor(caps)
  // Where WebGL is running, the liquid-glass lens *is* the cursor (see
  // CursorLens) and this one keeps only the dot you aim with. Two lenses
  // chasing the same pointer read as a rendering fault.
  const lensInWebGL = canRenderGlass(caps)

  useEffect(() => {
    if (!enabled) return

    const lens = lensRef.current
    const dot = dotRef.current
    if (!lens || !dot) return

    // Only now — so a device that never qualifies keeps its native cursor even
    // if this component mounted.
    document.documentElement.classList.add(styles.hideNative)

    // Cross-frame state, so refs rather than state: React must not re-render
    // for any of this.
    let lensX = pointerRaw.x * window.innerWidth
    let lensY = pointerRaw.y * window.innerHeight
    let wasInside: boolean | null = null

    const onPointerOver = (event: PointerEvent) => {
      const target = event.target as Element | null
      lens.classList.toggle(styles.over, !!target?.closest?.(INTERACTIVE))
    }
    document.addEventListener('pointerover', onPointerOver)

    const stop = onFrame((deltaSeconds) => {
      // Leaving the window parks the pointer bus back at centre; following it
      // there would fling the cursor across the page on the way out.
      if (pointer.inside !== wasInside) {
        wasInside = pointer.inside
        lens.classList.toggle(styles.away, !pointer.inside)
        dot.classList.toggle(styles.away, !pointer.inside)
      }
      if (!pointer.inside) return

      const x = pointerRaw.x * window.innerWidth
      const y = pointerRaw.y * window.innerHeight
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`

      // The bus's own easing is tuned for parallax; the lens wants its own,
      // slower, so it visibly trails the dot.
      const dt = Math.min(Math.max(deltaSeconds, 0), 0.1)
      const k = 1 - Math.exp(-LENS_LAMBDA * dt)
      lensX += (x - lensX) * k
      lensY += (y - lensY) * k

      // Stretch along the direction of travel and pinch across it — the shape a
      // drop takes when it is dragged.
      const dx = x - lensX
      const dy = y - lensY
      const stretch = Math.min(Math.hypot(dx, dy) / STRETCH_SCALE, STRETCH_MAX)
      const angle = Math.atan2(dy, dx)

      lens.style.transform =
        `translate3d(${lensX}px, ${lensY}px, 0) rotate(${angle}rad) ` +
        `scale(${1 + stretch}, ${1 - stretch * 0.55})`
    })

    return () => {
      stop()
      document.removeEventListener('pointerover', onPointerOver)
      document.documentElement.classList.remove(styles.hideNative)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div className={styles.cursor} aria-hidden="true">
      <div
        ref={lensRef}
        className={`${styles.lens} ${lensInWebGL ? styles.deferred : ''}`}
      />
      <div ref={dotRef} className={styles.dot} />
    </div>
  )
}
