import { WebGLSlot } from '@/components/dom/WebGLSlot'
import { SITE } from '@/lib/placeholder-content'
import styles from './Contact.module.css'

/** Contact — wireframe 1g. Holds the reserved wordmark / glass slot. */
export function Contact() {
  return (
    <section className={styles.section} aria-labelledby="contact-heading">
      <div className={styles.frame}>
        <h1 id="contact-heading" className={`display ${styles.heading}`}>
          Got something that needs cutting?
        </h1>

        {/* Reserved for the 3D wordmark / glass form — 720x300 @ 360,230 on the
            1440x810 frame. .frame is not a containing block, so on desktop this
            still resolves against the full-bleed section; below desktop it drops
            into flow here, between the heading and the details. Empty in
            Phase 2; Phase 3 binds to this rect. */}
        <WebGLSlot
          id="wordmark"
          label="Reserved — 3D wordmark / glass"
          dims="720 × 300 @ x360 y230"
          bounds={{ x: '25%', y: '28.4%', w: '50%', h: '37%' }}
        />

        <div className={styles.foot}>
          <div className={styles.emailBlock}>
            <span className="label">Email</span>
            <a className={styles.email} href={`mailto:${SITE.email}`}>
              {SITE.email}
            </a>
          </div>

          <ul className={styles.socials}>
            {SITE.socials.map((s, i) => (
              <li key={s.label}>
                <a
                  className={`${styles.social} ${
                    i === SITE.socials.length - 1 ? styles.socialBoxed : ''
                  }`}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {s.label} ↗<span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
