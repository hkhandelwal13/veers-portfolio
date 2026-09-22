import styles from './StageDressing.module.css'

/**
 * The stage behind everything: a blueprint grid with crosshairs at the
 * intersections.
 *
 * It used to carry a second layer as well — a slow diagonal light, a wide pale
 * radial plus drifting bands. That layer was the film washing the ground out.
 * Both halves were near-white at low alpha over the whole viewport, which is
 * the one thing that cannot be seen as light: it lifts every channel by the
 * same amount, so it does not brighten the blue, it desaturates it. The give-
 * away was the band between the closing screen and the footer, where no WebGL
 * ground paints and the true colour showed through several shades deeper.
 *
 * Gone from here and from the field shader both, so the ground is the wash and
 * nothing else.
 *
 * In *front* of the sections rather than behind them, because a section that
 * paints its own background — the project detail, the footer, the editor intro
 * — would otherwise hide the grid. The reference draws its rules across the
 * portrait and the wordmark too, so over the top is also the right look.
 *
 * Deliberately not a client component and not WebGL: one painted layer with no
 * state, no measurement and no per-frame work.
 */
export function StageDressing() {
  return (
    <div className={styles.gridStage} aria-hidden="true">
      <div className={styles.grid} />
    </div>
  )
}
