import { ProjectCard } from '@/components/dom/ProjectCard'
import { CATEGORIES, PROJECTS, SITE } from '@/lib/placeholder-content'
import styles from './WorkGrid.module.css'
import { Scramble } from '@/components/dom/Scramble'

/**
 * Selected work — wireframe 1c.
 *
 * HARD SPEC from the wireframe: 2 columns of 16:9 cards with a 24px gap on
 * desktop and tablet, 1 column on mobile.
 *
 * The second card is held open so the resting and revealed states are
 * reviewable side by side, exactly as the wireframe presents them.
 */
export function WorkGrid({
  showHoverExample = true,
  /** False when another section already cleared the fixed nav above it. */
  standalone = true,
}: {
  showHoverExample?: boolean
  standalone?: boolean
}) {
  return (
    <section
      className={`${styles.section} ${standalone ? '' : styles.stacked}`}
      aria-labelledby="work-heading"
    >
      <div className={styles.head}>
        <h2 id="work-heading" className="label">
          <Scramble text={`Selected work — ${SITE.totalProjects} projects`} />
        </h2>

        <ul className={styles.filters} aria-label="Categories">
          <li className={`${styles.chip} ${styles.chipOn}`}>All</li>
          {CATEGORIES.map((c) => (
            <li key={c} className={styles.chip}>
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.grid}>
        {PROJECTS.map((project, i) => (
          <ProjectCard
            key={project.slug}
            project={project}
            forceReveal={showHoverExample && i === 1}
          />
        ))}
      </div>

      <div className={styles.more}>
        <span className={styles.moreButton}>
          Load more — {SITE.totalProjects - PROJECTS.length} remaining
        </span>
      </div>
    </section>
  )
}
