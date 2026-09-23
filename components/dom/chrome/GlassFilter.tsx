import styles from './GlassFilter.module.css'

/** Shared displacement map for the captured backdrop. Soft, broad refraction
 * preserves smooth gradients; CSS overscan and a single outer clip prevent
 * transparent seams. sRGB avoids changing the page's colour space. */
export function GlassFilter() {
  return (
    <svg className={styles.hidden} aria-hidden="true" focusable="false">
      <defs>
        <filter id="liquid-glass" x="-20%" y="-50%" width="140%" height="200%"
          colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.01"
            numOctaves="1" seed="5" result="turbulence" />
          <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
          <feComponentTransfer in="softMap" result="lensMap">
            <feFuncR type="linear" slope="2" intercept="-0.5" />
            <feFuncG type="linear" slope="2" intercept="-0.5" />
          </feComponentTransfer>
          <feDisplacementMap in="SourceGraphic" in2="lensMap" scale="48"
            xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  )
}
