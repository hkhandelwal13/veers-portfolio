import { WebGLSlot } from '@/components/dom/WebGLSlot'
import { WebGLTarget } from '@/components/dom/WebGLTarget'
import { SITE } from '@/lib/placeholder-content'
import styles from './Contact.module.css'
import { Scramble } from '@/components/dom/Scramble'

/**
 * Contact — wireframe 1g. The closing screen, and the hero's arrangement
 * repeated: its own WebGL ground, the glass wordmark, and a sticker field
 * falling through it.
 *
 * `standalone` is false when it closes the home page, where the hero already
 * owns the h1 and this becomes a section heading instead.
 */
export function Contact({ standalone = true }: { standalone?: boolean }) {
  const Heading = standalone ? 'h1' : 'h2'
  return (
    <section className={styles.section} aria-labelledby="contact-heading">
      {/* The WebGL ground is seated on this. */}
      <WebGLTarget targetId="contact-field" className={styles.fieldTarget} aria-hidden="true" />
      <div className={styles.frame}>
        <Heading id="contact-heading" className={`display ${styles.heading}`}>
          Got something that needs cutting?
        </Heading>

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
            <Scramble className="label" text="Email" />
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
