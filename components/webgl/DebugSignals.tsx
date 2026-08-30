'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { getScrollActivity } from '@/lib/scroll-activity'
import { pointer } from '@/lib/pointer-bus'

/**
 * Live effect signals, published to `<html>` under `?webgl=debug`.
 *
 * The values that drive the Phase 4 effects are per-frame numbers that never
 * reach React, which makes them invisible when an effect misbehaves — is the
 * curl flat because the shader is wrong, or because its input is stuck at
 * zero? This answers that without a rebuild.
 *
 * Costs nothing when the flag is absent: the frame callback returns
 * immediately. When it is on, values are rounded and only written when they
 * actually change, so an idle page does not touch the DOM every frame.
 */
export function DebugSignals() {
  // A ref, not state: the flag is read only inside the frame callback, never
  // during render, and it never needs to trigger one.
  const enabled = useRef(false)
  const last = useRef('')

  useEffect(() => {
    enabled.current = new URLSearchParams(window.location.search).get('webgl') === 'debug'
  }, [])

  useFrame(() => {
    if (!enabled.current) return

    const activity = getScrollActivity().toFixed(3)
    const px = pointer.x.toFixed(3)
    const py = pointer.y.toFixed(3)
    const key = `${activity}|${px}|${py}|${pointer.inside}`
    if (key === last.current) return
    last.current = key

    const root = document.documentElement
    root.dataset.scrollActivity = activity
    root.dataset.pointerUv = `${px},${py}`
    root.dataset.pointerInside = String(pointer.inside)
  })

  return null
}
