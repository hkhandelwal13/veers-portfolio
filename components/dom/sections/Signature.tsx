'use client'

import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '@/lib/lenis'
import styles from './Signature.module.css'

/**
 * The signature over the portrait, written on as you arrive.
 *
 * An SVG path stroked on with dasharray rather than a script webfont: the site
 * deliberately loads no handwriting face (CLAUDE.md — Caveat was annotation ink
 * in the wireframes and stayed out of the build), and a font could only be
 * *revealed*, left to right, which reads as a wipe. A single continuous stroke
 * is drawn, which is what a hand does.
 *
 * `pathLength="1"` normalises the path's own length to 1, so the dash values
 * are plain numbers and nothing has to be measured with getTotalLength() after
 * layout.
 *
 * Plays once, when the section arrives. Reduced motion gets the finished mark
 * straight away, via a media query rather than via state.
 */

/**
 * One continuous stroke spelling "Veer".
 *
 * Hand-authored rather than traced from a font. Four things decide whether it
 * reads as the right word rather than as a squiggle, and each was learned by
 * getting it wrong:
 *
 *  - the capital takes no entry flourish, or that stroke reads as a first stem
 *    and turns V into N;
 *  - an 'e' loops *above* its own crossbar and crosses it on the way down. Loop
 *    around the outside instead and you have drawn a closed bowl, which is an
 *    'a';
 *  - the r gets one sharp peak, because a second turns "eer" into "em";
 *  - the exit flourish stays under the x-height, for the same reason.
 *
 * Baseline is y=96, the x-height top is y=52.
 */
const PATH =
  // V — two arms meeting at a point, no lead-in, small hook at the top right.
  'M 20 20 C 34 46 56 76 76 96 C 100 70 122 40 142 14 ' +
  // the terminal curl — a small closed loop at the top of the right arm. This
  // is what tells a cursive V from an N, which is otherwise the same three
  // strokes; without it the connector below reads as a second stem.
  'C 150 4 163 9 160 22 C 157 33 146 33 147 23 ' +
  // connector — a long shallow diagonal. Anything steeper reads as a third
  // stem sitting between the V's two arms, which is an N.
  'C 149 44 172 68 196 86 ' +
  // e — crossbar up, loop back over it, down through it, round and out
  'C 205 78 213 68 219 60 C 223 54 217 48 210 52 ' +
  'C 203 56 199 68 203 78 C 208 87 221 87 231 82 ' +
  // e — the same letter, 48 to the right
  'C 253 78 261 68 267 60 C 271 54 265 48 258 52 ' +
  'C 251 56 247 68 251 78 C 256 87 269 87 279 82 ' +
  // r — one rise to a point, a short shoulder, then down to the baseline
  'C 289 72 297 58 301 50 C 304 45 309 50 309 59 ' +
  'C 310 67 318 58 328 60 C 335 62 333 76 330 92 ' +
  // exit flourish, kept below the x-height
  'C 343 84 367 78 393 88'

export function Signature({ label = 'Veer' }: { label?: string }) {
  const ref = useRef<SVGSVGElement>(null)
  // Reduced motion is handled in CSS, not here — see the module. This state is
  // only ever about whether the draw has been triggered by arriving on screen.
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || prefersReducedMotion()) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        setDrawn(true)
      },
      // A little in from the edge: the mark sits at the very top of the
      // portrait, so firing on first contact means it is written off screen.
      { threshold: 0, rootMargin: '0px 0px -15% 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <svg
      ref={ref}
      className={`${styles.signature} ${drawn ? styles.drawn : ''}`}
      viewBox="0 0 412 116"
      fill="none"
      role="img"
      aria-label={label}
    >
      <path
        className={styles.stroke}
        d={PATH}
        pathLength="1"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
