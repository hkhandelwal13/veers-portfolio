import styles from './WebGLSlot.module.css'

/**
 * A reserved area for the WebGL layer.
 *
 * Phase 2 renders an empty positioned box, nothing more. In Phase 3 the
 * rect-sync system will query `[data-webgl]`, read each box's
 * getBoundingClientRect() and position a plane over it.
 *
 * Bounds are handed over as custom properties, not literal inline styles, so
 * the stylesheet can reflow them per breakpoint without fighting inline
 * specificity — see WebGLSlot.module.css.
 *
 * Desktop bounds come from PHASE2_KICKOFF §"Reserved 3D", which derives them
 * from the 1440x900 wireframe frame (hero: 720x360 @ 360,300 → 25% / 33.3% /
 * 50% / 40% of the section).
 */
export function WebGLSlot({
  id,
  label,
  dims,
  bounds,
  showMarker = true,
}: {
  /** Value for the data-webgl attribute the Phase 3 rect-sync will look up. */
  id: 'hero-hello' | 'wordmark'
  label: string
  dims: string
  /** Desktop bounds, as percentages of the containing section. */
  bounds: { x: string; y: string; w: string; h: string }
  showMarker?: boolean
}) {
  return (
    <div
      data-webgl={id}
      className={`${styles.slot} ${showMarker ? styles.marked : ''}`}
      style={
        {
          '--slot-x': bounds.x,
          '--slot-y': bounds.y,
          '--slot-w': bounds.w,
          '--slot-h': bounds.h,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      {showMarker && (
        <>
          <span className={styles.label}>{label}</span>
          <span className={styles.dims}>{dims}</span>
        </>
      )}
    </div>
  )
}
