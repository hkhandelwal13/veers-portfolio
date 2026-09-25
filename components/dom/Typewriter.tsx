'use client'

import { useEffect, useRef } from 'react'
import { isCurtainOpen, subscribeToCurtain } from '@/lib/stage-curtain'
import styles from './Typewriter.module.css'

/** Real, selectable text with stable wrapping; animates once when uncovered. */
export function Typewriter({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motion.matches) return
    const letters = Array.from(node.querySelectorAll<HTMLElement>('[data-letter]'))
    const animations: Animation[] = []
    let visible = false
    let started = false
    node.dataset.waiting = 'true'
    const finish = () => {
      delete node.dataset.waiting
      animations.forEach(animation => animation.cancel())
    }
    const start = () => {
      if (started || !visible || !isCurtainOpen()) return
      started = true
      delete node.dataset.waiting
      const accent = getComputedStyle(node).getPropertyValue('--accent-2').trim() || '#b8e614'
      const interval = Math.min(32, 2200 / Math.max(letters.length, 1))
      letters.forEach((letter, index) => {
        animations.push(letter.animate([
          { opacity: 0, color: accent, offset: 0 },
          { opacity: 1, color: accent, offset: 0.01 },
          { opacity: 1, color: accent, offset: 0.3 },
          { opacity: 1, color: '#ffffff', offset: 1 },
        ], { duration: 500, delay: index * interval, fill: 'backwards' }))
      })
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      start()
    }, { threshold: 0.15 })
    observer.observe(node)
    const unsubscribe = subscribeToCurtain(start)
    const onMotion = () => { if (motion.matches) { started = true; finish() } }
    motion.addEventListener('change', onMotion)
    return () => { observer.disconnect(); unsubscribe(); motion.removeEventListener('change', onMotion); finish() }
  }, [text])

  return <span ref={ref} className={`${styles.text} ${className}`}>
    {text.split(/(\s+)/).map((word, index) => /^\s+$/.test(word) ? word :
      <span className={styles.word} key={index}>
        {Array.from(word).map((letter, position) => <span data-letter key={position}>{letter}</span>)}
      </span>)}
  </span>
}
