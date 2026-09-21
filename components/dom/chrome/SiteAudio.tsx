'use client'

import { useEffect } from 'react'
import { armAudio, attachAudioShortcut, initAudio, isAudioArmed } from '@/lib/site-audio'
import { getScrollSnapshot, subscribeToScroll } from '@/lib/scroll-bus'

/**
 * Renders nothing. Adopts the remembered sound preference, and opens the
 * arming gate the first time the page is scrolled.
 *
 * Armed off the ScrollBus rather than off a `scroll` listener of its own, for
 * the reason everything else in the site reads it: Lenis is the scroll, and a
 * native listener would be a second opinion about where the page is. The bus
 * is published from the one rAF the site owns, so this costs a boolean compare
 * per frame until it fires and nothing at all afterwards.
 *
 * "Scrolled" is measured as movement away from wherever the page started, not
 * as `scrollTop > 0`: a reload restores the offset, and a visitor who lands
 * four screens down and has not touched anything yet has not scrolled.
 */
const ARM_DISTANCE_PX = 8

export function SiteAudio() {
  useEffect(() => {
    initAudio()
    const detachShortcut = attachAudioShortcut()
    if (isAudioArmed()) return detachShortcut

    const origin = getScrollSnapshot().scrollTop
    const unsubscribe = subscribeToScroll(() => {
      if (Math.abs(getScrollSnapshot().scrollTop - origin) < ARM_DISTANCE_PX) return
      armAudio()
      unsubscribe()
    })
    return () => {
      detachShortcut()
      unsubscribe()
    }
  }, [])

  return null
}
