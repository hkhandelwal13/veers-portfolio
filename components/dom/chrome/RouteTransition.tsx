'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '@/lib/lenis'
import { DotMatrix } from './DotMatrix'
import styles from './RouteTransition.module.css'

/**
 * Dot-matrix wipe between routes (CLAUDE.md §5.5) — the same language as the
 * loader and the mobile menu.
 *
 * Internal link clicks are intercepted so the panel can close over the current
 * page *before* the route changes; without that the new page renders behind a
 * grid that is still growing and you watch the swap happen through the gaps.
 * The uncover then runs off the pathname actually changing, so the wipe is tied
 * to the real navigation rather than to a guess about how long it takes.
 *
 * Reduced motion opts out completely: no interception, no panel, links navigate
 * exactly as they would with this component absent.
 */

/** Must cover --dm-grow + --dm-stagger on .sheet. */
const COVER_MS = 620

/** If a navigation never lands, uncover anyway rather than trapping the page. */
const SAFETY_MS = 2500

export function RouteTransition() {
  const router = useRouter()
  const pathname = usePathname()
  const [covered, setCovered] = useState(false)

  // Uncover on the render where the new route arrives — adjusting state during
  // render rather than in an effect, so the panel never paints over the new
  // page for a frame it did not need to.
  const [shownPath, setShownPath] = useState(pathname)
  if (shownPath !== pathname) {
    setShownPath(pathname)
    setCovered(false)
  }

  const timers = useRef<{ push?: ReturnType<typeof setTimeout>; safety?: ReturnType<typeof setTimeout> }>(
    {},
  )

  useEffect(() => {
    if (prefersReducedMotion()) return

    const onClick = (event: MouseEvent) => {
      // Anything that isn't a plain left-click on a same-tab internal link is
      // the browser's business, not ours.
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = (event.target as Element | null)?.closest?.('a')
      if (!anchor) return
      if (anchor.hasAttribute('download')) return
      const target = anchor.getAttribute('target')
      if (target && target !== '_self') return

      const href = anchor.getAttribute('href')
      if (!href || !href.startsWith('/') || href.startsWith('//')) return

      const url = new URL(href, location.href)
      // Same page, or a jump to an anchor on it: no route change to cover.
      if (url.pathname === location.pathname) return

      event.preventDefault()
      setCovered(true)

      clearTimeout(timers.current.push)
      clearTimeout(timers.current.safety)
      timers.current.push = setTimeout(() => {
        router.push(url.pathname + url.search + url.hash)
      }, COVER_MS)
      timers.current.safety = setTimeout(() => setCovered(false), SAFETY_MS)
    }

    // Capture phase, deliberately. next/link handles the click on the anchor
    // itself and pushes straight away; a bubbling listener would only ever see
    // an event that has already navigated. Capturing at the document gets us in
    // first, and next/link bails on a click whose default is already prevented,
    // so preventDefault alone hands us the navigation — no stopPropagation,
    // which would also swallow the mobile menu's own close-on-click.
    document.addEventListener('click', onClick, true)
    const pending = timers.current
    return () => {
      document.removeEventListener('click', onClick, true)
      clearTimeout(pending.push)
      clearTimeout(pending.safety)
    }
  }, [router])

  return (
    <div className={styles.stage} aria-hidden="true">
      <DotMatrix covered={covered} className={styles.sheet} />
    </div>
  )
}
