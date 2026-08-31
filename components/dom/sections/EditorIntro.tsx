import { Scramble } from '@/components/dom/Scramble'
import { SITE } from '@/lib/placeholder-content'
import styles from './EditorIntro.module.css'

/**
 * Who is cutting — the section the hero hands over to.
 *
 * Deliberately the opposite ground to everything above it: flat black in the
 * dark theme, flat white in the light one, with none of the blueprint dressing.
 * The hero is a stage; this is the person stepping out of it, and the palette
 * change is what makes the scroll read as an arrival rather than as more page.
 *
 * The hero's WebGL ground travels toward --section-ground as it dissolves, so
 * by the time this scrolls up the handover has already happened underneath.
 *
 * Layout and copy are a placeholder to hold the shape: the portrait, the
 * signature and the real introduction land with the design handoff.
 */
export function EditorIntro() {
  return (
    <section className={styles.section} aria-labelledby="editor-heading">
      <div className={styles.inner}>
        <figure className={styles.portrait}>
          <div className={styles.portraitFill} aria-hidden="true">
            <span className={styles.portraitLabel}>Portrait 4:5</span>
          </div>
          <figcaption className={styles.signature} aria-hidden="true">
            Veer
          </figcaption>
        </figure>

        <div className={styles.copy}>
          <Scramble className={styles.eyebrow} text="The editor" />

          <h2 id="editor-heading" className={styles.lead}>
            {SITE.bio[0]}
          </h2>

          <p className={styles.body}>{SITE.bio[1]}</p>

          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>
                <Scramble text="Based in" />
              </dt>
              <dd>{SITE.basedIn}</dd>
            </div>
            <div className={styles.fact}>
              <dt>
                <Scramble text="Since" />
              </dt>
              <dd>{SITE.since}</dd>
            </div>
            <div className={styles.fact}>
              <dt>
                <Scramble text="Toolkit" />
              </dt>
              <dd>{SITE.toolkit}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
