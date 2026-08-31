/**
 * Site theme — dark or light.
 *
 * DECISIONS locks the direction: "Dark-first is primary (video reads better on
 * dark). Light = the warm-greige system as the secondary theme via the THEME
 * toggle." So dark is the default and light is the alternate, even though the
 * Phase 2 wireframes were drawn light.
 *
 * The theme lives on `<html data-theme>`; CSS remaps the semantic tokens from
 * there, so nothing in the component tree needs to know which theme is active.
 * The one exception is WebGL, which cannot read CSS per frame — hence the
 * mirror into lib/surface.
 */

import { setThemeDark } from './surface'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'vl-theme'
export const DEFAULT_THEME: Theme = 'dark'

let current: Theme = DEFAULT_THEME
const listeners = new Set<() => void>()

/**
 * Runs before first paint, inlined in the document head.
 *
 * Kept as a string so it can be injected synchronously: reading localStorage in
 * an effect means the first paint uses the default theme and then swaps, which
 * is a full-page flash on every load for anyone who chose the non-default.
 */
export const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme = stored === 'light' || stored === 'dark' ? stored : '${DEFAULT_THEME}';
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = '${DEFAULT_THEME}';
  }
})();
`

/** Browser UI chrome (address bar, PWA surround) follows the page ground. */
const THEME_COLOR: Record<Theme, string> = { light: '#cbe2f5', dark: '#0a1038' }

function apply(theme: Theme) {
  current = theme
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme])
  // WebGL reads this per frame; a DOM lookup there would be waste.
  setThemeDark(theme === 'dark')
  for (const listener of listeners) listener()
}

/** Adopts whatever the bootstrap script already put on the element. */
export function initTheme() {
  if (typeof document === 'undefined') return
  const attribute = document.documentElement.dataset.theme
  apply(attribute === 'light' ? 'light' : 'dark')
}

export function setTheme(theme: Theme) {
  if (theme === current) return
  apply(theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Private mode or blocked storage: the choice just will not persist.
  }
}

export function toggleTheme() {
  setTheme(current === 'dark' ? 'light' : 'dark')
}

export function getTheme(): Theme {
  return current
}

export function subscribeToTheme(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getServerTheme(): Theme {
  return DEFAULT_THEME
}

/**
 * The "A" shortcut the nav's THEME[A] label advertises.
 *
 * Registered once, from the app-wide provider, rather than by the toggle
 * button — the toggle renders in both the nav and the mobile menu, and two
 * listeners would flip the theme twice per press.
 */
export function attachThemeShortcut() {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'a' && event.key !== 'A') return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (event.repeat || event.defaultPrevented) return

    // Never steal the key from someone typing.
    const target = event.target as HTMLElement | null
    if (target?.isContentEditable) return
    const tag = target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

    toggleTheme()
  }

  document.addEventListener('keydown', onKeyDown)
  return () => document.removeEventListener('keydown', onKeyDown)
}
