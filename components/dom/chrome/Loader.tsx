'use client'

import { useEffect, useState } from 'react'
import { getLenis, prefersReducedMotion } from '@/lib/lenis'
import { isHeroReady, subscribeToHeroReady } from '@/lib/hero-ready'
import { setCurtain } from '@/lib/stage-curtain'
import { DotMatrix } from './DotMatrix'
import styles from './Loader.module.css'

/**
 * Loading screen — wireframe 1a.
 *
 * The wireframe reserved a 6x6 grid with the note "dot-matrix reveal / added in
 * code"; this is that code. The reveal is not an element on the screen, it is
 * how the screen leaves: the loader's ground *is* the matrix, and the site is
 * uncovered by a hole opening out from the middle. Same wipe as the route
 * transition and the mobile menu (see DotMatrix).
 *
 * Shown on every document load, including refresh. Waits for fonts and the
 * hero model's first rendered frame before opening the shutter.
 */

const WIPE_MS = 960
const MIN_VISIBLE_MS = 900
const MAX_WAIT_MS = 8000

type Phase = 'loading' | 'wiping' | 'done'

export function Loader() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(0)

  const effective = phase
  const done = effective === 'done'

  // Keep text reveals queued until the shutter has fully uncovered the model.
  useEffect(() => {
    setCurtain('loader', !done)
  }, [done])
  useEffect(() => () => setCurtain('loader', false), [])

  useEffect(() => {
    const lenis = getLenis()
    lenis?.stop()

    const shownAt = performance.now()

    // Creep toward 90% so the bar always moves, then let the real signal
    // finish it — a bar that sits at 0 reads as broken.
    const creep = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(1, Math.round((90 - p) / 8)) : p))
    }, 90)

    let settle: ReturnType<typeof setTimeout>
    let stopped = false
    let finishing = false
    let fontsReady = false
    const needsHello = !!document.querySelector('[data-webgl="hero-hello"]')
    const finish = () => {
      if (stopped || finishing) return
      finishing = true
      clearInterval(creep)
      setProgress(100)
      const held = performance.now() - shownAt
      settle = setTimeout(() => {
        setPhase('wiping')
        // The wipe uncovers the site, so scrolling can resume the moment it
        // starts rather than after it finishes.
        getLenis()?.start()
        // Not transitionend: under reduced motion the global rule collapses
        // every duration to 0.01ms and the event fires before this even binds.
        settle = setTimeout(() => setPhase('done'), prefersReducedMotion() ? 0 : WIPE_MS)
      }, Math.max(320, MIN_VISIBLE_MS - held))
    }

    // A rendered mesh is the readiness signal; never hold a failed WebGL page forever.
    const check = () => { if (fontsReady && (!needsHello || isHeroReady())) finish() }
    const unsubscribe = subscribeToHeroReady(check)
    const cap = setTimeout(finish, MAX_WAIT_MS)
    document.fonts.ready.then(() => { fontsReady = true; check() })

    return () => {
      stopped = true
      unsubscribe()
      clearInterval(creep)
      clearTimeout(cap)
      clearTimeout(settle)
      getLenis()?.start()
    }
  }, [])

  // Nothing left to paint once the wipe is through, and the grid is a few
  // hundred nodes — drop the lot rather than leaving it hidden.
  if (done) return null

  return (
    <div
      className={`${styles.loader} ${effective === 'wiping' ? styles.leaving : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      {/* The panel's own background covers the one frame before the grid has
          measured the viewport; from then on the matrix carries the same
          colour, and .leaving hands over to it. */}
      <DotMatrix covered={effective === 'loading'} className={styles.sheet} />

      <div className={styles.content}>
        <span className={styles.wordmark}>Veerlabs</span>

        <div className={styles.track} aria-hidden="true">
          <div className={styles.bar} style={{ width: `${progress}%` }} />
        </div>

        <span className={styles.count}>{String(progress).padStart(3, '0')} / 100</span>

        <span className={styles.status}>Loading assets</span>
      </div>
    </div>
  )
}

