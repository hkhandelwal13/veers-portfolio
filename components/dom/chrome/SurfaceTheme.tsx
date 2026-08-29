'use client'

import { useEffect } from 'react'

/**
 * Declares the surface the page chrome sits on.
 *
 * The nav, HUD and footer are mounted once in the layout, above the route, so
 * they can't see that a given screen (project detail) is dark. This sets
 * data-surface on <html>, which globals.css maps to the --chrome-* tokens the
 * chrome actually paints with. Rendering nothing itself, it's a plain DOM sync
 * — exactly what an effect is for.
 */
export function SurfaceTheme({ value }: { value: 'light' | 'dark' }) {
  useEffect(() => {
    const root = document.documentElement
    const previous = root.dataset.surface
    root.dataset.surface = value

    return () => {
      if (previous) root.dataset.surface = previous
      else delete root.dataset.surface
    }
  }, [value])

  return null
}
