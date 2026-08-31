'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useScrollFlag } from '@/lib/use-scroll'
import { MobileMenu } from './MobileMenu'
import { ThemeToggle } from './ThemeToggle'
import styles from './Nav.module.css'

export const NAV_LINKS = [
  { href: '/work', label: 'Work' },
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/contact', label: 'Contact' },
]

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

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      <nav
        className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}
        aria-label="Primary"
      >
        <ul className={styles.links}>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`${styles.link} ${isActive(link.href) ? styles.active : ''}`}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className={styles.themeSlot}>
            <ThemeToggle />
          </li>
        </ul>

        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          aria-controls="mobile-menu"
        >
          Menu ☰
        </button>
      </nav>

      <MobileMenu open={menuOpen} onClose={closeMenu} />
    </>
  )
}
