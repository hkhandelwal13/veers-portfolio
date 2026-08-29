'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { getLenis } from '@/lib/lenis'
import styles from './Loader.module.css'

/**
 * Loading screen — wireframe 1a.
 *
 * Phase 2 builds the structure only: the 6x6 grid is a static placeholder that
 * reserves the reveal's footprint. The dot-matrix shader that actually drives
 * it is Phase 4, along with the same language for page transitions.
 *
 * Shown once per session so it doesn't tax repeat visits. Real asset progress
 * arrives with the shader; until then it tracks font loading, which is the one
 * thing genuinely blocking first paint.
 */

/** Which of the 36 cells are filled — fixed pattern, from the wireframe. */
const CELLS = [
  1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0,
  1, 0, 1, 1, 0, 1, 0, 1, 1, 0,
]

const SEEN_KEY = 'vl-loaded'

/** A loader that flashes past is worse than none, so hold it for at least this
 *  long once shown. Caps at MAX_WAIT_MS if the real signal never arrives. */
const MIN_VISIBLE_MS = 900
const MAX_WAIT_MS = 2500

/** The flag can't change during a session, so the subscription is a no-op —
 *  this is here to read an external store without an effect. */
const noopSubscribe = () => () => {}

function useAlreadyLoaded() {
  return useSyncExternalStore(
    noopSubscribe,
    () => sessionStorage.getItem(SEEN_KEY) === '1',
    // Server can't know; assume a first visit so the markup always includes
    // the loader and the client can hide it immediately if it has been seen.
    () => false,
  )
}

export function Loader() {
  const alreadyLoaded = useAlreadyLoaded()
  const [finished, setFinished] = useState(false)
  const [progress, setProgress] = useState(0)

  const done = alreadyLoaded || finished

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
        setFinished(true)
        getLenis()?.start()
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

  return (
    <div
      className={`${styles.loader} ${done ? styles.hidden : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
      inert={done ? true : undefined}
    >
      <span className={styles.wordmark}>Veerlabs</span>

      <div className={styles.matrix} aria-hidden="true">
        {CELLS.map((on, i) => (
          <span key={i} className={on ? styles.cellOn : styles.cellOff} />
        ))}
      </div>

      <span className={styles.note}>Dot-matrix reveal / added in code</span>

      <div className={styles.track} aria-hidden="true">
        <div className={styles.bar} style={{ width: `${progress}%` }} />
      </div>

      <span className={styles.count}>{String(progress).padStart(3, '0')} / 100</span>

      <span className={styles.status}>Loading assets</span>
    </div>
  )
}
