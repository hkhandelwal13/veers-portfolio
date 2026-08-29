'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { SITE } from '@/lib/placeholder-content'
import { getLenis } from '@/lib/lenis'
import { NAV_LINKS } from './Nav'
import styles from './MobileMenu.module.css'

/**
 * Full-screen mobile menu (wireframe 1h, open state).
 *
 * Behaves as a modal dialog: Escape closes it, focus moves in on open and back
 * to the trigger on close, and Tab is trapped inside while it's open. Lenis is
 * stopped so the page behind doesn't scroll.
 */
export function MobileMenu({
  open,
  /** Must be referentially stable — the effect below re-runs when it changes,
   *  and its cleanup restores focus to the trigger. */
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const lastFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    lastFocused.current = document.activeElement as HTMLElement | null

    // The panel is still visibility:hidden on the frame this effect runs, and
    // a hidden element can't take focus — so move focus on the next frame,
    // once the open class has been applied.
    const focusFrame = requestAnimationFrame(() => closeRef.current?.focus())

    // The single Lenis instance owns scrolling; stop it rather than setting
    // overflow:hidden, which it would fight.
    const lenis = getLenis()
    lenis?.stop()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key !== 'Tab' || !panelRef.current) return

      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      )
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKeyDown)
      lenis?.start()
      lastFocused.current?.focus()
    }
  }, [open, onClose])

  return (
    <div
      id="mobile-menu"
      ref={panelRef}
      className={`${styles.menu} ${open ? styles.open : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      // Hidden from the accessibility tree and from tab order when closed.
      inert={!open ? true : undefined}
    >
      <div className={styles.bar}>
        <span className={styles.wordmark}>Veerlabs</span>
        <button type="button" ref={closeRef} className={styles.close} onClick={onClose}>
          Close ✕
        </button>
      </div>

      <nav aria-label="Menu">
        <ul className={styles.links}>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={styles.link} onClick={onClose}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.footer}>
        <a className={styles.email} href={`mailto:${SITE.email}`}>
          {SITE.email}
        </a>
        <ul className={styles.socials}>
          {SITE.socials.map((s) => (
            <li key={s.label}>
              <a
                className={styles.social}
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                {s.short}
                <span className="visually-hidden"> ({s.label}, opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.meta}>
        <span>Theme[A]</span>
        <span>GMT+5:30</span>
      </div>
    </div>
  )
}
