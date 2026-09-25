'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { useScrollFlag } from '@/lib/use-scroll'
import { MobileMenu } from './MobileMenu'
import { SoundToggle } from './SoundToggle'
import { ThemeToggle } from './ThemeToggle'
import { LiquidGlass } from './LiquidGlass'
import { scrollToSection } from '@/lib/section-scroll'
import styles from './Nav.module.css'

export const NAV_LINKS = [
  { href: '/#about', sectionId: 'about', label: 'About' },
  { href: '/#work', sectionId: 'work', label: 'Work' },
  { href: '/#contact', sectionId: 'contact', label: 'Contact' },
] as const

/**
 * Nav — default (transparent, over the hero), scrolled (tint + hairline, 56px)
 * and active-item states from wireframe 1h.
 *
 * The wordmark lives in the HUD's top-left corner, not here, so the two never
 * duplicate; this bar holds only the links and the menu button.
 */
export function Nav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  // Reads the ScrollBus, not window.scrollY — one scroll source for DOM and
  // WebGL alike. A boolean means React bails out until the threshold flips,
  // so this costs one render per state change, not one per frame.
  const scrolled = useScrollFlag((s) => s.scrollTop > 24)

  const goToSection = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, sectionId: string) => {
      if (pathname !== '/') return
      event.preventDefault()
      scrollToSection(sectionId)
    },
    [pathname],
  )

  useEffect(() => {
    if (pathname !== '/' || !window.location.hash) return
    const sectionId = window.location.hash.slice(1)
    const first = requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToSection(sectionId, false))
    })
    return () => cancelAnimationFrame(first)
  }, [pathname])

  return (
    <>
      <nav
        className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}
        aria-label="Primary"
      >
        <LiquidGlass />

        <ul className={styles.links}>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                scroll={false}
                className={styles.link}
                onClick={(event) => goToSection(event, link.sectionId)}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className={styles.themeSlot}>
            <ThemeToggle />
          </li>
        </ul>

        {/* Outside the list on purpose: the list collapses into the menu
            button below desktop, and the sound control has to stay reachable
            in one tap while the music is playing. The wrapper carries the
            bar's typography, which the control would otherwise have inherited
            from the list it is no longer in. */}
        <div className={styles.soundSlot}>
          <SoundToggle />
        </div>

        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          aria-controls="mobile-menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </nav>

      <MobileMenu open={menuOpen} onClose={closeMenu} />
    </>
  )
}
