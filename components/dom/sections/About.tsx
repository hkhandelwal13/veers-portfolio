import { SITE } from '@/lib/placeholder-content'
import styles from './About.module.css'
import { Scramble } from '@/components/dom/Scramble'

/** About — wireframe 1e. Portrait is marked optional in the wireframe. */
export function About() {
  const facts = [
    { label: 'Based in', value: SITE.basedIn },
    { label: 'Since', value: SITE.since },
    { label: 'Toolkit', value: SITE.toolkit },
  ]

  return (
    <section className={styles.section} aria-labelledby="about-heading">
      <div className={styles.top}>
        <div className={styles.portraitCol}>
          <div className={`${styles.portrait} hatch`}>Portrait 4:5</div>
          <span className="label">Optional — can be dropped for type-only</span>
        </div>

        <div className={styles.body}>
          <h1 id="about-heading" className={`display ${styles.heading}`}>
            An editor who finishes what he cuts.
          </h1>

          <div className={styles.copy}>
            {SITE.bio.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          <dl className={styles.facts}>
            {facts.map((f) => (
              <div key={f.label} className={styles.fact}>
                <dt className="label">
                  <Scramble text={f.label} />
                </dt>
                <dd className={styles.factValue}>{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className={styles.clients}>
        <h2 className={`label ${styles.clientsTitle}`}>Selected clients</h2>
        <ul className={styles.logos}>
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className={styles.logo}>
              Logo
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
