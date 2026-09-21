'use client'

import { useEffect } from 'react'
import { attachAudioShortcut, isAudioPlaying, startAudio } from '@/lib/site-audio'
import { getScrollSnapshot, subscribeToScroll } from '@/lib/scroll-bus'

/**
 * Renders nothing. Starts the background track, and keeps the S shortcut.
 *
 * The track is on by default and stays on until the visitor turns it off, so
 * the only thing standing between arrival and sound is the browser's own
 * autoplay rule. The first attempt goes out on mount; if it is refused, the
 * store parks it and starts at the next click, key or tap (lib/site-audio).
 *
 * One more attempt goes out on the first scroll. Not because a scroll is a
 * gesture — it is not, in any engine — but because by then the page may have
 * accrued enough media engagement for the browser to relent, and an attempt
 * costs one function call. Read off the ScrollBus rather than a listener of
 * its own, for the reason everything here reads it: Lenis is the scroll, and a
 * native listener would be a second opinion about where the page is.
 */
const RETRY_DISTANCE_PX = 8

export function SiteAudio() {
  useEffect(() => {
    startAudio()
    const detachShortcut = attachAudioShortcut()

    const origin = getScrollSnapshot().scrollTop
    const unsubscribe = subscribeToScroll(() => {
      if (Math.abs(getScrollSnapshot().scrollTop - origin) < RETRY_DISTANCE_PX) return
      unsubscribe()
      if (!isAudioPlaying()) startAudio()
    })

    return () => {
      detachShortcut()
      unsubscribe()
    }
  }, [])

  return null
}
