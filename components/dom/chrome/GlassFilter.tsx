import styles from './GlassFilter.module.css'

/** Shared refraction map. CSS limits it to the glass rim, leaving the central
 * gradient and foreground text intact. Overscan in CSS and an expanded SVG
 * region keep the displacement from sampling transparent pane boundaries. */
export function GlassFilter() {
  return (
    <svg className={styles.hidden} aria-hidden="true" focusable="false">
      <defs>
        <filter id="liquid-glass" x="-20%" y="-50%" width="140%" height="200%"
          colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.01"
            numOctaves="1" seed="5" result="turbulence" />
          <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
          <feDisplacementMap in="SourceGraphic" in2="softMap" scale="16"
            xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  )
}
