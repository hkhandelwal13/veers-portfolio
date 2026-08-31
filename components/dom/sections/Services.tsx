import { SITE } from '@/lib/placeholder-content'
import styles from './Services.module.css'
import { Scramble } from '@/components/dom/Scramble'

/** Services — wireframe 1f. */
export function Services() {
  return (
    <section className={styles.section} aria-labelledby="services-heading">
      <div className={styles.head}>
        <h1 id="services-heading" className={`display ${styles.heading}`}>
          Three disciplines, one timeline.
        </h1>
        <Scramble className="label" text={`${SITE.services.length} disciplines`} />
      </div>

      <ul className={styles.grid}>
        {SITE.services.map((service) => (
          <li key={service.index} className={styles.card}>
            <span className="label">{service.index}</span>
            <h2 className={styles.cardTitle}>{service.title}</h2>
            <p className={styles.cardBody}>{service.body}</p>
            <ul className={styles.items}>
              {service.items.map((item) => (
                <li key={item}>— {item}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className={styles.cta}>
        <a className={styles.ctaButton} href="/contact">
          Start a project
        </a>
        <Scramble className="label" text="Typical turnaround 2–4 weeks" />
      </div>
    </section>
  )
}
