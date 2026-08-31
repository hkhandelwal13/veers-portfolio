import styles from './StageDressing.module.css'

/**
 * The stage behind everything: a faint blueprint grid with crosshairs at the
 * intersections, and slow diagonal light across it.
 *
 * It is what stops the page reading as a flat colour field. The glass gets its
 * depth from refracting a scene, and until now the scene was one flat clear
 * colour; this gives the ground somewhere to be.
 *
 * Two layers at two depths, on purpose. The light sits behind everything; the
 * grid sits in *front* of the sections, because a section that paints its own
 * background — the project detail, the footer, the editor intro — would
 * otherwise hide it. The reference draws its rules across the portrait and the
 * wordmark too, so over the top is also the right look.
 *
 * Deliberately not a client component and not WebGL: painted layers with no
 * state, no measurement and no per-frame work.
 */
export function StageDressing() {
  return (
    <>
      <div className={styles.stage} aria-hidden="true">
        <div className={styles.streaks} />
      </div>
      {/* Separate layer, in front of the sections rather than behind them, so a
          section that paints its own background does not erase the grid. */}
      <div className={styles.gridStage} aria-hidden="true">
        <div className={styles.grid} />
      </div>
    </>
  )
}
