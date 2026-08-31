'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { getLenis, prefersReducedMotion } from '@/lib/lenis'
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
 * Shown once per session so it doesn't tax repeat visits. Real asset progress
 * arrives with the content in Phase 5; until then it tracks font loading, which
 * is the one thing genuinely blocking first paint.
 */

const SEEN_KEY = 'vl-loaded'

/** How long the wipe runs: --dm-grow + --dm-stagger on .sheet, plus slack. */
const WIPE_MS = 960

/** A loader that flashes past is worse than none, so hold it for at least this
 *  long once shown. Caps at MAX_WAIT_MS if the real signal never arrives. */
const MIN_VISIBLE_MS = 900
const MAX_WAIT_MS = 2500

/** The answer can't change during a session, so the subscription is a no-op —
 *  this is here to read an external store without an effect. */
const noopSubscribe = () => () => {}

/**
 * Latched on the first client read.
 *
 * React calls getSnapshot on every render, and this loader writes the flag
 * itself — so reading storage live would make the loader see "already loaded"
 * one render after it starts its own exit, and collapse mid-wipe. What matters
 * is whether the flag was set when the page opened.
 */
let seenAtStart: boolean | null = null

function readSeen(): boolean {
  seenAtStart ??= sessionStorage.getItem(SEEN_KEY) === '1'
  return seenAtStart
}

function useAlreadyLoaded() {
  return useSyncExternalStore(
    noopSubscribe,
    readSeen,
    // Server can't know; assume a first visit so the markup always includes
    // the loader and the client can hide it immediately if it has been seen.
    () => false,
  )
}

type Phase = 'loading' | 'wiping' | 'done'

export function Loader() {
  const alreadyLoaded = useAlreadyLoaded()
  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(0)

  const effective: Phase = alreadyLoaded ? 'done' : phase
  const done = effective === 'done'

  useEffect(() => {
    if (alreadyLoaded) return

    const lenis = getLenis()
    lenis?.stop()

    const shownAt = performance.now()

    // Creep toward 90% so the bar always moves, then let the real signal
    // finish it — a bar that sits at 0 reads as broken.
    const creep = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(1, Math.round((90 - p) / 8)) : p))
    }, 90)

    let settle: ReturnType<typeof setTimeout>
    const finish = () => {
      clearInterval(creep)
      setProgress(100)
      const held = performance.now() - shownAt
      settle = setTimeout(() => {
        sessionStorage.setItem(SEEN_KEY, '1')
        setPhase('wiping')
        // The wipe uncovers the site, so scrolling can resume the moment it
        // starts rather than after it finishes.
        getLenis()?.start()
        // Not transitionend: under reduced motion the global rule collapses
        // every duration to 0.01ms and the event fires before this even binds.
        settle = setTimeout(() => setPhase('done'), prefersReducedMotion() ? 0 : WIPE_MS)
      }, Math.max(320, MIN_VISIBLE_MS - held))
    }

    // document.fonts.ready can hang on a flaky network; cap the wait so the
    // site is never held hostage by it.
    const cap = setTimeout(finish, MAX_WAIT_MS)
    document.fonts.ready.then(() => {
      clearTimeout(cap)
      finish()
    })

    return () => {
      clearInterval(creep)
      clearTimeout(cap)
      clearTimeout(settle)
      getLenis()?.start()
    }
  }, [alreadyLoaded])

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
