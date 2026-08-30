import { WebGLTarget } from './WebGLTarget'
import styles from './WebGLSlot.module.css'

/**
 * A reserved area for the WebGL layer.
 *
 * The box stays empty: CSS positions and sizes it, the rect sampler measures
 * it, and the canvas draws over the result. Bounds are handed over as custom
 * properties rather than literal inline styles so the stylesheet can reflow
 * them per breakpoint without fighting inline specificity — see
 * WebGLSlot.module.css.
 *
 * Desktop bounds come from PHASE2_KICKOFF §"Reserved 3D", derived from the
 * 1440x900 wireframe frame (hero: 720x360 @ 360,300 → 25% / 33.3% / 50% / 40%).
 *
 * `showMarker` draws the wireframe's dashed outline and dimensions — useful for
 * checking alignment, off by default now that the model actually fills the box.
 */
export function WebGLSlot({
  id,
  label,
  dims,
  bounds,
  showMarker = false,
}: {
  /** Value for the data-webgl attribute the rect sampler keys on. */
  id: 'hero-hello' | 'wordmark'
  label: string
  dims: string
  /** Desktop bounds, as percentages of the containing section. */
  bounds: { x: string; y: string; w: string; h: string }
  showMarker?: boolean
}) {
  return (
    <WebGLTarget
      targetId={id}
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
    </WebGLTarget>
  )
}
