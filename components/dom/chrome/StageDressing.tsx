import styles from './StageDressing.module.css'

/**
 * The stage behind everything: a faint blueprint grid with crosshairs at the
 * intersections, and slow diagonal light across it.
 *
 * It is what stops the page reading as a flat colour field. The glass gets its
 * depth from refracting a scene, and until now the scene was one flat clear
 * colour; this gives the ground somewhere to be.
 *
 * Deliberately not a client component and not WebGL: it is two painted layers
 * with no state, no measurement and no per-frame work. It sits at z-index 0,
 * below --z-canvas, so the canvas and every route still draw over it.
 */
export function StageDressing() {
  return (
    <div className={styles.stage} aria-hidden="true">
      <div className={styles.grid} />
      <div className={styles.streaks} />
    </div>
  )
}
