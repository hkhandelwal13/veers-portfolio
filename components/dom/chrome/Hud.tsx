'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import styles from './Hud.module.css'

/**
 * Four-corner HUD (PHASE2_KICKOFF "HUD motif") — built once, mounted in the
 * site layout, shared by every screen:
 *
 *   top-left      VEERLABS wordmark (the nav does not repeat it)
 *   bottom-left   live GMT+5:30 timestamp
 *   bottom-centre per-screen status line
 *   bottom-right  small ring
 *
 * The overlay is pointer-events:none so it never blocks the page; the wordmark
 * link opts back in. Its ink follows the --chrome-* tokens, so it inverts on
 * dark screens without needing to be told which page it's on.
 */

const IST_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function useIstClock() {
  // Null until mounted: the server and the visitor's machine are in different
  // zones and would render different text, so the first paint stays neutral.
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    const tick = () => setTime(IST_FORMATTER.format(new Date()))
    tick()
    // Align to the next minute, then tick once a minute — the readout only
    // shows hours and minutes, so a per-second interval would be waste.
    let interval: ReturnType<typeof setInterval>
    const timeout = setTimeout(() => {
      tick()
      interval = setInterval(tick, 60_000)
    }, (60 - new Date().getSeconds()) * 1000)

    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [])

  return time
}

/**
 * The footer carries its own bottom telemetry row (wireframe 1i), so the HUD's
 * bottom row would sit on top of a duplicate. Fade that row out once the footer
 * arrives and let the footer's take over.
 */
function useFooterInView() {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const footer = document.querySelector('footer')
    if (!footer) return

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  return inView
}

export function Hud({ status }: { status: string }) {
  const time = useIstClock()
  const footerInView = useFooterInView()
  // Only the bottom row defers to the footer; the top-left wordmark is the
  // home link and stays visible on every screen.
  const handoff = footerInView ? styles.handedOff : ''

  return (
    <div className={styles.hud}>
      <div className={`${styles.corner} ${styles.topLeft}`}>
        <Link href="/" className={styles.wordmark}>
          Veerlabs
        </Link>
      </div>

      <div className={`${styles.corner} ${styles.bottomLeft} ${handoff}`}>
        <span>
          GMT+5:30 IN
          {/* suppressHydrationWarning isn't needed — time is null on the
              server and on the client's first paint alike. */}
          {time ? ` — ${time}` : ''}
        </span>
      </div>

      <div className={`${styles.corner} ${styles.bottomCenter} ${handoff}`}>
        <span>{status}</span>
      </div>

      <div className={`${styles.corner} ${styles.bottomRight} ${handoff}`}>
        <span className={styles.ring} aria-hidden="true" />
      </div>
    </div>
  )
}
