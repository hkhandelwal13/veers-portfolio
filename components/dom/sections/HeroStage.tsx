import { WebGLTarget } from '@/components/dom/WebGLTarget'
import styles from './HeroStage.module.css'

/**
 * The hero and everything it hands over to, as one surface.
 *
 * They used to be two: a WebGL ground that stopped at the hero's edge, and a
 * section below painting its own opaque black. Whatever the wipe was doing at
 * the moment they met was a visible line, because a half-covered ground meeting
 * a fully covered one is a boundary however smoothly either side is animating.
 *
 * So there is no second background. The dot matrix *is* how the ground turns
 * black — its coverage keeps rising across every section wrapped here, and none
 * of them has anything of its own to paint. One surface cannot have a seam,
 * wherever you happen to be looking at it.
 *
 * The intro keeps a CSS ground for the case where the canvas never mounts; see
 * EditorIntro.module.css.
 */
export function HeroStage({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.stage}>
      <WebGLTarget targetId="hero-stage" className={styles.target} aria-hidden="true" />
      {children}
    </div>
  )
}
