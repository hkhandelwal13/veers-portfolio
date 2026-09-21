'use client'

import { useEffect, useRef } from 'react'
import styles from './Signature.module.css'

/**
 * The signature over the portrait, written on as you arrive.
 *
 * Stroked on with dasharray rather than set in a script webfont: the site
 * deliberately loads no handwriting face (CLAUDE.md — Caveat was annotation ink
 * in the wireframes and stayed out of the build), and a font could only be
 * *revealed*, left to right, which reads as a wipe. Strokes are drawn, which is
 * what a hand does.
 *
 * Two paths, because the mark is two pen strokes: the word, then the underline
 * beneath it. They draw in that order, and the second waits for the first — a
 * signature is sequential, and drawing both at once reads as two unrelated
 * lines appearing rather than as one hand writing.
 *
 * Written again every time you arrive, from either direction — it is the
 * section's entrance, not a one-off. Two observers rather than one, because
 * the moment to start writing and the moment to clear the page are not the
 * same moment: it starts once the mark is properly on screen, and resets only
 * once it is entirely gone. One observer doing both would have to reset at the
 * same line it draws at, which means watching the signature blink out while it
 * is still visible at the bottom of the screen.
 *
 * Reduced motion gets the finished mark straight away, via a media query
 * rather than via state: the component cannot initialise from
 * prefersReducedMotion() because that is false on the server and true on the
 * client, so hydration would render the undrawn markup and, with the observer
 * skipped, nothing would ever flip it.
 */

/**
 * The mark itself — supplied as artwork, not authored here.
 *
 * `pathLength="1"` normalises each path's own length to 1, so the dash values
 * in CSS are plain numbers and the hidden state is declared rather than
 * measured. That matters for more than tidiness: dash values written by an
 * effect land a frame after paint, which is one frame of the finished
 * signature sitting there before it hides itself to draw.
 */
const WORD =
  'M 24 76 ' +
  'C 44 48, 68 42, 73 60 ' +
  'C 78 79, 61 138, 77 160 ' +
  'C 90 174, 121 111, 143 62 ' +
  'C 156 34, 166 23, 168 32 ' +
  'C 171 46, 143 94, 139 116 ' +
  'C 137 129, 147 133, 159 126 ' +
  'C 174 118, 194 105, 194 95 ' +
  'C 194 85, 180 87, 171 98 ' +
  'C 160 112, 160 132, 175 135 ' +
  'C 189 139, 207 122, 219 111 ' +
  'C 231 101, 244 94, 244 86 ' +
  'C 243 77, 230 81, 222 92 ' +
  'C 211 107, 212 126, 226 128 ' +
  'C 242 131, 261 111, 274 95 ' +
  // The final r: a short shoulder, then down, then a restrained exit rather
  // than the long rising flourish the first draft ended on.
  'C 281 85, 287 74, 288 70 ' +
  'C 292 76, 301 80, 312 75 ' +
  'C 306 85, 296 102, 295 112 ' +
  'C 294 122, 305 122, 318 117 ' +
  'C 333 111, 348 101, 361 91'

const UNDERLINE =
  'M 127 163 C 202 144, 292 141, 370 136 C 396 134, 420 135, 431 141'

/**
 * Pen speed, in user units per second.
 *
 * Each stroke's duration comes from its own measured length divided by this,
 * rather than every stroke taking the same time. With pathLength normalising
 * the geometry, equal durations would draw the short underline at a fifth of
 * the speed of the word — the same pen visibly slowing down for the last
 * stroke, which is the one thing that gives away that this is not a hand.
 */
const PEN_RATE = 700
/** Beat between strokes: the pause while the pen is lifted and repositioned. */
const LIFT_SECONDS = 0.08
/** Before the first stroke — the mark should land after you have arrived. */
const FIRST_DELAY = 0.3

export function Signature({ label = 'Veer' }: { label?: string }) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = ref.current
    if (!svg) return

    const paths = Array.from(svg.querySelectorAll<SVGPathElement>('path'))

    // Timing is measured; the dash geometry is not (see WORD above). A stroke
    // whose length cannot be read — no layout box yet, an engine that reports
    // the normalised length — falls back to the CSS default duration rather
    // than to nothing.
    let delay = FIRST_DELAY
    for (const path of paths) {
      const length = path.getTotalLength()
      if (!Number.isFinite(length) || length <= 1) continue
      const duration = Math.max(0.18, length / PEN_RATE)
      path.style.setProperty('--path-duration', `${duration}s`)
      path.style.setProperty('--path-delay', `${delay}s`)
      delay += duration + LIFT_SECONDS
    }

    const draw = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        svg.classList.add(styles.drawing)
      },
      // A little in from the edge: the mark sits at the very top of the
      // portrait, so firing on first contact means it is written off screen.
      { threshold: 0, rootMargin: '0px 0px -15% 0px' },
    )

    const reset = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) return
        // Dropping the class takes the animation with it, which returns the
        // strokes to the dashoffset declared on .stroke — so the next arrival
        // starts from a blank page rather than replaying from finished. No
        // reflow trick needed: the class is off for as long as the section is
        // off screen, which is many frames.
        svg.classList.remove(styles.drawing)
      },
      // No margin here: clear it only once it is genuinely gone, in whichever
      // direction it left.
      { threshold: 0 },
    )

    draw.observe(svg)
    reset.observe(svg)
    return () => {
      draw.disconnect()
      reset.disconnect()
    }
  }, [])

  return (
    <svg
      ref={ref}
      className={styles.signature}
      viewBox="0 0 460 210"
      fill="none"
      role="img"
      aria-label={label}
    >
      {/* Written on a slant, as it was drawn. On the group rather than on the
          paths so the two strokes cannot drift out of register with each
          other, and so the rotation is not part of what gets animated. */}
      <g transform="rotate(-9 230 105)">
        <path className={styles.stroke} d={WORD} pathLength="1" />
        <path className={styles.stroke} d={UNDERLINE} pathLength="1" />
      </g>
    </svg>
  )
}
