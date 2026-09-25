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
 * Every card is closed at rest. One used to be pinned open so the resting and
 * revealed states could be approved side by side from a screenshot; with real
 * posters and real footage on the cards that is no longer a review aid, it is
 * one card behaving differently from the other seven.
 */
export function WorkGrid({
  /** False when another section already cleared the fixed nav above it. */
  standalone = true,
}: {
  standalone?: boolean
}) {
  return (
    <section
      id="work"
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
        {PROJECTS.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </section>
  )
}
