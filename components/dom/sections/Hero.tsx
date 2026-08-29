import { WebGLSlot } from '@/components/dom/WebGLSlot'
import { SITE } from '@/lib/placeholder-content'
import styles from './Hero.module.css'

/**
 * Home / hero — wireframe 1b.
 *
 * The wireframe's rule is that the wordmark, nav, tagline and intro all sit
 * OUTSIDE the reserved 3D rect and never overlap it; only the display headline
 * crosses it, and does so above it in z-order.
 */
export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      {/* Reserved for the 3D "hello" — 720x360 @ 360,300 on the 1440x900
          frame. Positioned against the full-bleed section, not the padded
          content frame, so the percentages resolve against the whole viewport
          width exactly as the wireframe measures them. Empty by design:
          Phase 3 binds the model to this rect. */}
      <WebGLSlot
        id="hero-hello"
        label='Reserved — 3D "hello" layer'
        dims="720 × 360 @ x360 y300 / WebGL, not DOM"
        bounds={{ x: '25%', y: '33.333%', w: '50%', h: '40%' }}
      />

      <div className={styles.frame}>
        <div className={styles.top}>
          <div className={styles.taglineBlock}>
            <span className={`label ${styles.eyebrow}`}>Video editor — Color — Motion</span>
            <p className={styles.tagline}>
              Cutting commercials, music videos and documentary from assembly to
              delivery.
            </p>
          </div>

          <p className={styles.intro}>
            Based in {SITE.basedIn}. Working with agencies, labels and independent
            producers since {SITE.since} — colour and finishing handled in-house.
          </p>
        </div>

        <h1 id="hero-heading" className={`display ${styles.headline}`}>
          Story first. Everything else is finishing.
        </h1>

        <a className={styles.showreel} href="#showreel">
          <span className={styles.playGlyph} aria-hidden="true" />
          Play showreel — {SITE.showreelRuntime}
        </a>

        <div className={styles.cue} aria-hidden="true">
          <span className={styles.cueLine} />
          <span className="label">Scroll</span>
        </div>
      </div>
    </section>
  )
}
