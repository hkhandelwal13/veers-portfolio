'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import type { PlaceholderProject } from '@/lib/placeholder-content'
import { CARD_TARGET_PREFIX } from '@/components/webgl/card-target-id'
import { clearHoverIntent, setHoverIntent } from '@/lib/hover-bus'
import { WebGLTarget } from './WebGLTarget'
import styles from './ProjectCard.module.css'

/**
 * Work card — wireframe 1c, with the Phase 4 dot-matrix hover reveal.
 *
 * The poster frame is a WebGL target: it stays transparent and the canvas draws
 * the poster behind it, aligned to this element's rect. CSS keeps owning the
 * grid, the ratio and the gap — see components/webgl/CardMirror.tsx.
 *
 * Hover and focus are pushed to the hover bus rather than React state: the
 * reveal is drawn on the GPU, so re-rendering the grid on every pointer cross
 * would buy nothing. Focus is wired alongside hover so the reveal is never
 * mouse-only.
 *
 * `forceReveal` holds a card open, which the work grid uses to show the default
 * and revealed states side by side, exactly as the wireframe presents them.
 */
export function ProjectCard({
  project,
  forceReveal = false,
}: {
  project: PlaceholderProject
  forceReveal?: boolean
}) {
  const targetId = `${CARD_TARGET_PREFIX}${project.slug}`

  useEffect(() => {
    if (forceReveal) setHoverIntent(targetId, true)
    return () => clearHoverIntent(targetId)
  }, [targetId, forceReveal])

  const open = () => {
    if (!forceReveal) setHoverIntent(targetId, true)
  }
  const close = () => {
    if (!forceReveal) setHoverIntent(targetId, false)
  }

  return (
    <article className={styles.card}>
      <Link
        href={`/work/${project.slug}`}
        className={styles.link}
        onPointerEnter={open}
        onPointerLeave={close}
        onFocus={open}
        onBlur={close}
      >
        <WebGLTarget targetId={targetId} className={styles.poster}>
          <span className={styles.posterLabel} aria-hidden="true">
            Poster 16:9
          </span>

          {/* Metadata only. The imagery underneath it is the WebGL reveal, so
              this layer must not paint over the card — just a scrim strong
              enough to keep the text legible. */}
          <div
            className={styles.overlay}
            style={forceReveal ? { opacity: 1 } : undefined}
            aria-hidden="true"
          >
            {project.categories[0] && (
              <span className={styles.badge}>{project.categories[0]}</span>
            )}

            <div className={styles.overlayMeta}>
              <div className={styles.overlayTitle}>
                <span className={styles.overlayName}>{project.title}</span>
                <span className={styles.overlayRole}>{project.role}</span>
              </div>
              <span className={styles.view}>View ↗</span>
            </div>
          </div>
        </WebGLTarget>

        <div className={styles.meta}>
          <h3>{project.title}</h3>
          <span className={styles.year}>{project.year}</span>
        </div>
      </Link>

      <ul className={styles.tags}>
        {project.categories.map((c) => (
          <li key={c} className={styles.tag}>
            {c}
          </li>
        ))}
      </ul>
    </article>
  )
}
