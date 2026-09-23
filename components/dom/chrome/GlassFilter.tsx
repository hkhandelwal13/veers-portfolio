import styles from './GlassFilter.module.css'

/**
 * The displacement filter the floating panes refract through.
 *
 * This is what separates liquid glass from frosted glass. A blur alone tells
 * you something is in front of the page; a displacement tells you it has a
 * *shape* — the page bends where the pane is thick and runs straight where it
 * is thin, the way a lens does. The turbulence is the thickness map: a low
 * base frequency gives a few broad swells across a bar rather than a ripple,
 * which is the difference between a pane of glass and frosted plastic.
 *
 * Rendered once, from the site layout, because an SVG filter is referenced by
 * id and two copies of the same id is undefined behaviour — whichever the
 * document finds first wins, which changes with route order.
 *
 * Support is honest rather than universal: Chromium applies an SVG filter over
 * what `backdrop-filter` produced, so there the page genuinely bends. Safari
 * and Firefox do not, and quietly ignore the filter — which leaves the blur,
 * the tint and the shine, i.e. the frosted pane the site had before. Nothing
 * is broken anywhere; the refraction is a bonus where it lands.
 */
export function GlassFilter() {
  return (
    <svg className={styles.hidden} aria-hidden="true" focusable="false">
      <filter
        id="liquid-glass"
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        filterUnits="objectBoundingBox"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.008 0.012"
          numOctaves="1"
          seed="5"
          result="turbulence"
        />
        {/* Softened before it is used to push pixels: raw fractal noise
            displaces neighbouring pixels in opposite directions and reads as
            static rather than as glass. */}
        <feGaussianBlur in="turbulence" stdDeviation="4" result="softMap" />
        {/*
         * Scale is the whole tuning of this effect. The macOS reference uses
         * 150 on a dock two hundred pixels tall; the same number on a 48px bar
         * would displace every pixel clean off it. 26 is about half the bar's
         * height, which is as far as the page can bend before the letters
         * behind it stop being letters.
         */}
        <feDisplacementMap
          in="SourceGraphic"
          in2="softMap"
          scale="26"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>

    </svg>
  )
}
