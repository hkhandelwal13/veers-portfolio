'use client'

import Link from 'next/link'
import { SITE } from '@/lib/placeholder-content'
import { getLenis } from '@/lib/lenis'
import { NAV_LINKS } from './Nav'
import styles from './Footer.module.css'

/** Dark footer — wireframe 1i. */
export function Footer() {
  const toTop = () => {
    // Route through Lenis so the scroll stays on the one loop.
    const lenis = getLenis()
    if (lenis) lenis.scrollTo(0)
    else window.scrollTo({ top: 0 })
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <div className={styles.callout}>
          <span className={styles.calloutLabel}>Let&rsquo;s cut something good</span>
          <p className={styles.calloutTitle}>
            <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
          </p>
        </div>

        <div className={styles.columns}>
          <nav className={styles.column} aria-label="Footer">
            <span className={styles.columnTitle}>Site</span>
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className={styles.column}>
            <span className={styles.columnTitle}>Elsewhere</span>
            {SITE.socials.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noreferrer noopener">
                {s.label} ↗<span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.bottom}>
        <span>Veerlabs © {new Date().getFullYear()} — All rights reserved</span>
        <span className={styles.coords} aria-hidden="true">
          0220 X 0441 Y
        </span>
        <button type="button" className={styles.toTop} onClick={toTop}>
          Back to top ↑
        </button>
      </div>
    </footer>
  )
}
