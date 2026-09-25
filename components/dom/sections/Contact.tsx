import { Scramble } from '@/components/dom/Scramble'
import { WebGLSlot } from '@/components/dom/WebGLSlot'
import { WebGLTarget } from '@/components/dom/WebGLTarget'
import styles from './Contact.module.css'

/**
 * Contact — wireframe 1g. The closing screen, and the hero's arrangement
 * repeated: its own WebGL ground, the glass wordmark, and a sticker field
 * falling through it.
 *
 * The address and the social links used to close this section too. They are
 * the footer's, and the footer is the very next thing on the page — printing
 * them twice, a screen apart, made the closing screen read as a summary of
 * the footer rather than as the last held frame.
 *
 * `standalone` is false when it closes the home page, where the hero already
 * owns the h1 and this becomes a section heading instead.
 */
export function Contact({ standalone = true }: { standalone?: boolean }) {
  const Heading = standalone ? 'h1' : 'h2'
  return (
    <section
      id="contact"
      className={`${styles.section} ${standalone ? '' : styles.stacked}`}
      aria-labelledby="contact-heading"
    >
      {/* The WebGL ground is seated on this. */}
      <WebGLTarget targetId="contact-field" className={styles.fieldTarget} aria-hidden="true" />
      <div className={styles.frame}>
        <Heading id="contact-heading" className={`display ${styles.heading}`}>
          <Scramble neon text="Got something that needs direction?" />
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
      </div>
    </section>
  )
}

