import Link from 'next/link'
import type { PlaceholderProject } from '@/lib/placeholder-content'
import styles from './ProjectDetail.module.css'
import { Scramble } from '@/components/dom/Scramble'
import { VideoPlayer } from './VideoPlayer'

/**
 * Project detail — wireframe 1d, dark treatment.
 *
 * The player is a real <video> behind our own chrome — see VideoPlayer. This
 * component stays a server component: only the player needs to be interactive,
 * so only the player crosses to the client.
 */
export function ProjectDetail({
  project,
  next,
}: {
  project: PlaceholderProject
  next: PlaceholderProject
}) {
  const meta = [
    { key: 'Client', value: project.client },
    { key: 'Role', value: project.role },
    { key: 'Year', value: String(project.year) },
    { key: 'Runtime', value: project.runtime },
  ]

  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <Link href="/work" className={styles.back}>
            ← Back to work
          </Link>
          <h1 className={`display ${styles.title}`}>{project.title}</h1>
        </div>

        <ul className={styles.tags}>
          {project.categories.map((c) => (
            <li key={c} className={styles.tag}>
              {c}
            </li>
          ))}
        </ul>
      </header>

      <VideoPlayer src={project.video} poster={project.poster} title={project.title} />

      <div className={styles.body}>
        <section aria-labelledby="about-edit">
          <h2 id="about-edit" className={`label ${styles.copyTitle}`}>
            About the edit
          </h2>
          <div className={styles.copy}>
            {project.description.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </section>

        <section aria-labelledby="meta-heading">
          <h2 id="meta-heading" className={`label ${styles.metaTitle}`}>
            Meta
          </h2>
          <dl className={styles.metaList}>
            {meta.map((row) => (
              <div key={row.key} className={styles.metaRow}>
                <dt className={styles.metaKey}>{row.key}</dt>
                <dd className={styles.metaValue}>{row.value}</dd>
              </div>
            ))}
          </dl>

          <h3 className={`label ${styles.creditsTitle}`}>Credits</h3>
          <dl className={styles.metaList}>
            {project.credits.map((credit) => (
              <div key={credit.role} className={styles.metaRow}>
                <dt className={styles.metaKey}>{credit.role}</dt>
                <dd className={styles.metaValue}>{credit.name}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <ul className={styles.stills}>
        {['Still 01', 'Still 02', 'Still 03'].map((s) => (
          <li key={s} className={styles.still}>
            {s}
          </li>
        ))}
      </ul>

      <nav className={styles.next} aria-label="Next project">
        <Link href={`/work/${next.slug}`} className={styles.nextLeft}>
          <Scramble className="label" text="Next project" />
          <span className={styles.nextTitle}>{next.title}</span>
        </Link>
        <div className={styles.nextThumb} aria-hidden="true" />
      </nav>
    </article>
  )
}
