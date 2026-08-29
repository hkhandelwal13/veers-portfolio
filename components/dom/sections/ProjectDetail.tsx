import Link from 'next/link'
import type { PlaceholderProject } from '@/lib/placeholder-content'
import styles from './ProjectDetail.module.css'

/**
 * Project detail — wireframe 1d, dark treatment.
 *
 * The player is chrome only: poster frame, centre play control, scrubber and
 * the control row. The real <video>, its R2 sources and the control wiring are
 * Phase 5 — this fixes the layout they drop into. Controls are always visible
 * here; the wireframe notes they fade on hover/pause on pointer devices and
 * stay visible on touch, which is behaviour, not layout.
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

      <div className={styles.player}>
        <div className={styles.playerFill}>Poster frame / full video 16:9</div>

        <button type="button" className={styles.playButton} aria-label={`Play ${project.title}`}>
          <span className={styles.playGlyph} aria-hidden="true" />
        </button>

        {/* Static control chrome — wired to a real <video> in Phase 5. */}
        <div className={styles.controls}>
          <div className={styles.scrubber}>
            <div className={styles.progress} style={{ width: '34%' }}>
              <span className={styles.knob} />
            </div>
          </div>

          <div className={styles.controlRow}>
            <div className={styles.controlLeft}>
              <span className={styles.pauseGlyph} aria-hidden="true">
                <span />
                <span />
              </span>
              <span>00:42 / {project.runtime}</span>
            </div>

            <div className={styles.controlRight}>
              <button type="button">Mute</button>
              <button type="button">CC</button>
              <button type="button">1080p</button>
              <button type="button">⤢ Fullscreen</button>
            </div>
          </div>
        </div>
      </div>

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
          <span className="label">Next project</span>
          <span className={styles.nextTitle}>{next.title}</span>
        </Link>
        <div className={styles.nextThumb} aria-hidden="true" />
      </nav>
    </article>
  )
}
