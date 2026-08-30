'use client'

import { useEffect, useSyncExternalStore } from 'react'
import {
  getCapabilities,
  getServerCapabilities,
  subscribeToCapabilities,
} from '@/lib/capabilities'

/**
 * Alignment and capability overlay, opt-in via `?webgl=debug`.
 *
 * Outlines every `data-webgl` rect so you can see whether the canvas is drawing
 * where the DOM says it should, and reflects the live effect-shutoff inputs
 * onto `<html>` so you can tell *why* an effect is off on a given device
 * without reading the source.
 *
 * Off unless asked for, and it only sets attributes — no layout, no effect on
 * the normal page. Reads location directly rather than useSearchParams so the
 * pages it appears on stay statically rendered.
 */
export function WebGLDebug() {
  const caps = useSyncExternalStore(
    subscribeToCapabilities,
    getCapabilities,
    getServerCapabilities,
  )

  useEffect(() => {
    const enabled = new URLSearchParams(window.location.search).get('webgl') === 'debug'
    if (!enabled) return

    const root = document.documentElement
    root.dataset.webglDebug = '1'
    root.dataset.capHover = String(caps.hoverCapable)
    root.dataset.capReducedMotion = String(caps.reducedMotion)
    root.dataset.capCompact = String(caps.compact)

    return () => {
      delete root.dataset.webglDebug
      delete root.dataset.capHover
      delete root.dataset.capReducedMotion
      delete root.dataset.capCompact
    }
  }, [caps])

  return null
}
