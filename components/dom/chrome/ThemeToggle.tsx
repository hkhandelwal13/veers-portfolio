'use client'

import { useSyncExternalStore } from 'react'
import { getServerTheme, getTheme, subscribeToTheme, toggleTheme } from '@/lib/theme'
import styles from './ThemeToggle.module.css'

/**
 * The wireframe's THEME[A] slot, made real.
 *
 * Deliberately carries no typography or colour of its own: it renders in the
 * nav (chrome tokens) and inside the dark mobile menu (on-dark tokens), and
 * inheriting from whichever row it sits in is what keeps those two matching
 * their neighbours without a variant prop per surface.
 *
 * The store is module-level, not context — the shaders read it per frame from
 * lib/surface and must not depend on React having re-rendered.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, getServerTheme)
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleTheme}
      aria-pressed={theme === 'dark'}
      aria-label={`Dark theme, ${theme === 'dark' ? 'on' : 'off'}. Switch to ${next}. Keyboard shortcut A.`}
    >
      <span aria-hidden="true">Theme[A]</span>
      <span
        aria-hidden="true"
        className={`${styles.dot} ${theme === 'dark' ? styles.dotFilled : ''}`}
      />
    </button>
  )
}
