'use client'

import { useEffect } from 'react'

/**
 * Alignment overlay, opt-in via `?webgl=debug`.
 *
 * Outlines every `data-webgl` rect so you can see whether the canvas is
 * actually drawing where the DOM says it should. Off unless asked for, and it
 * only sets an attribute — no layout, no effect on the normal page.
 *
 * Reads location directly rather than useSearchParams so the pages it appears
 * on stay statically rendered.
 */
export function WebGLDebug() {
  useEffect(() => {
    const enabled = new URLSearchParams(window.location.search).get('webgl') === 'debug'
    if (!enabled) return

    document.documentElement.dataset.webglDebug = '1'
    return () => {
      delete document.documentElement.dataset.webglDebug
    }
  }, [])

  return null
}
