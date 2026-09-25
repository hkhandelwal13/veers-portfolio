'use client'

import { useEffect } from 'react'
import {
  attachAudioShortcut,
  attachFirstScrollAudioAttempt,
  startAudio,
} from '@/lib/site-audio'

/**
 * Renders nothing. Starts the background track and keeps the S shortcut.
 *
 * The track is on by default. We try once on mount, then install a one-shot
 * raw wheel/trackpad listener so the first scroll intent gets a synchronous
 * playback attempt before Lenis turns that input into animated movement.
 *
 * If the browser's autoplay policy still rejects wheel-started sound, the audio
 * store remains parked and the next qualifying click/tap/key/touch-end starts
 * it. That fallback is required by the web platform; wheel is not guaranteed
 * to create user activation.
 */

export function SiteAudio() {
  useEffect(() => {
    startAudio()
    const detachShortcut = attachAudioShortcut()
    const detachFirstScrollAttempt = attachFirstScrollAudioAttempt()

    return () => {
      detachShortcut()
      detachFirstScrollAttempt()
    }
  }, [])

  return null
}
