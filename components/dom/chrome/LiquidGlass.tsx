import styles from './LiquidGlass.module.css'

/** All decorative layers share one expanding clip; content remains outside it. */
export function LiquidGlass() {
  return (
    <span className={styles.surface} data-liquid-glass aria-hidden="true">
      <span className={styles.refraction} />
      <span className={styles.tint} />
      <span className={styles.shine} />
    </span>
  )
}
