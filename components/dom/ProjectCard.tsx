'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import type { PlaceholderProject } from '@/lib/placeholder-content'
import { CARD_TARGET_PREFIX } from '@/components/webgl/card-target-id'
import { registerCardAssets } from '@/lib/card-assets'
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
 * The poster and the preview clip are registered the same way and for the same
 * reason — see lib/card-assets.
 */
export function ProjectCard({ project }: { project: PlaceholderProject }) {
  const targetId = `${CARD_TARGET_PREFIX}${project.slug}`

  useEffect(() => clearHoverIntent.bind(null, targetId), [targetId])

  useEffect(
    () => registerCardAssets(targetId, { poster: project.poster, preview: project.preview }),
    [targetId, project.poster, project.preview],
  )

  const open = () => setHoverIntent(targetId, true)
  const close = () => setHoverIntent(targetId, false)

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
          {/* The CSS fallback for a page with no canvas: a real <img>, so the
              work is still there without WebGL, and so the poster is in the
              markup for a crawler and for a print. Hidden once the stage is
              live, where the mirrored plane supplies the same image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={project.poster} alt="" className={styles.posterImage} loading="lazy" />

          {/* Metadata only. The imagery underneath it is the WebGL reveal, so
              this layer must not paint over the card — just a scrim strong
              enough to keep the text legible. */}
          <div className={styles.overlay} aria-hidden="true">
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
