import { WebGLSlot } from '@/components/dom/WebGLSlot'
import { WebGLTarget } from '@/components/dom/WebGLTarget'
import { SITE } from '@/lib/placeholder-content'
import styles from './Hero.module.css'
import { Scramble } from '@/components/dom/Scramble'

/** The responsive grid reserves separate rows for the model and headline. */
export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <link rel="preload" href="/models/hello.glb" as="fetch" crossOrigin="anonymous" />
      {/* The WebGL ground is seated on this, not on the viewport, so it scrolls
          away with the section instead of covering whatever comes next. */}
      <WebGLTarget targetId="hero-field" className={styles.fieldTarget} aria-hidden="true" />
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
            <Scramble neon reveal
              className={`label ${styles.eyebrow}`}
              text="Video editor — Color — Motion"
            />
            <p className={styles.tagline}>
              <Scramble neon reveal text="Cutting commercials, music videos and documentary from assembly to delivery." />
            </p>
          </div>

          <p className={styles.intro}>
            <Scramble neon reveal text={`Based in ${SITE.basedIn}. Working with agencies, labels and independent producers since ${SITE.since} — colour and finishing handled in-house.`} />
          </p>
        </div>

        <h1 id="hero-heading" className={`display ${styles.headline}`}>
          <Scramble neon reveal text="Story first. Everything else is finishing." />
        </h1>

      </div>
    </section>
  )
}

