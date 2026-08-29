import Link from 'next/link'
import type { PlaceholderProject } from '@/lib/placeholder-content'
import styles from './ProjectCard.module.css'

/**
 * Work card — wireframe 1c.
 *
 * Phase 2 builds both states structurally: the default poster frame, and the
 * hover overlay (badge + title + role + view affordance) that the preview loop
 * will play behind in Phase 4. No video and no reveal yet.
 *
 * `forceOverlay` renders the hover state statically, which the work grid uses
 * so the design is reviewable without a pointer.
 */
export function ProjectCard({
  project,
  forceOverlay = false,
}: {
  project: PlaceholderProject
  forceOverlay?: boolean
}) {
  return (
    <article className={styles.card}>
      <Link href={`/work/${project.slug}`} className={styles.link}>
        <div className={`${styles.poster} hatch`}>
          <span className={styles.posterLabel} aria-hidden="true">
            Poster 16:9
          </span>

          <div
            className={styles.overlay}
            style={forceOverlay ? { opacity: 1 } : undefined}
            aria-hidden="true"
          >
            {/* Phase 4 replaces this fill with the muted R2 preview loop. */}
            <div className={styles.overlayFill}>Preview loop</div>

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
        </div>

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
