'use client'

import styles from './Scramble.module.css'
import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/lenis'
import { scramble } from '@/lib/scramble'
import { isCurtainOpen, subscribeToCurtain } from '@/lib/stage-curtain'

/**
 * Text that decodes into place — the typographic half of the retro-futurist
 * language (the dot matrix is the other half). Both turn continuous progress
 * into discrete units; this one's unit is a character.
 *
 * Plays once, when two things are true: the element has entered the viewport,
 * and no fullscreen wipe is covering the page. Waiting on the second is what
 * stops the whole above-the-fold set decoding behind the loader and being over
 * before anyone sees it.
 *
 * The real text is always in the accessibility tree — the animating node is
 * aria-hidden and a visually-hidden twin carries the copy — so a screen reader
 * is never handed a half-decoded string, and the text is right with JS off.
 *
 * Best on monospace: the scrambled characters have to be the same width as the
 * real ones or the line reflows on every tick.
 */
export function Scramble({ text, className, neon = false }: { text: string; className?: string; neon?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    // Reduced motion gets the finished text, which is what the markup already
    // says — so there is nothing to do but stay out of the way.
    if (prefersReducedMotion()) return

    let cancelDecode: (() => void) | null = null
    let unsubscribeCurtain: (() => void) | null = null
    let seen = false
    let colorAnimation: Animation | undefined

    const start = () => {
      unsubscribeCurtain?.()
      unsubscribeCurtain = null
      cancelDecode = scramble(element, text)
      if (neon) {
        const color = getComputedStyle(element).getPropertyValue('--accent-2').trim() || '#b8e614'
        colorAnimation = element.animate([{ color }, { color, offset: 0.35 }, { color: '#fff' }], { duration: 800 })
      }
    }

    const onVisible = () => {
      if (isCurtainOpen()) {
        start()
        return
      }
      unsubscribeCurtain = subscribeToCurtain(() => {
        if (isCurtainOpen()) start()
      })
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (seen || !entries.some((entry) => entry.isIntersecting)) return
        seen = true
        observer.disconnect()
        onVisible()
      },
      // No negative margin. Trimming the bottom of the root to avoid firing on
      // things barely peeking in also excludes anything pinned down there — the
      // HUD sits 28px off the bottom edge and would never decode at all.
      { threshold: 0 },
    )
    observer.observe(element)

    return () => {
      observer.disconnect()
      unsubscribeCurtain?.()
      cancelDecode?.()
      colorAnimation?.cancel()
    }
  }, [text, neon])

  return (
    <span className={className}>
      <span ref={ref} className={neon ? styles.neon : undefined} aria-hidden="true">
        {text}
      </span>
      <span className="visually-hidden">{text}</span>
    </span>
  )
}

