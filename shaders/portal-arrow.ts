/**
 * The finale arrow's material: the hero's glass, with the tunnel inside it.
 *
 * Composed from glassFragmentShader rather than restated, so the arrow's
 * refraction, dispersion, rim, specular and tint stay literally the same code
 * the `hello` uses — the finale is meant to be the hero's object doing
 * something else, not a lookalike that drifts from it.
 *
 * The one addition is at the end: `uPortal` cross-fades the finished glass into
 * the warp field, and takes the alpha to opaque with it. That is what makes the
 * arrow a window rather than a shape with a picture on it — the field is
 * sampled in screen space, so it stays anchored to the viewport's centre while
 * the arrow turns and swells across it, and the silhouette is the only mask it
 * ever needs.
 *
 * The two splices below are asserted at module load. Silent string surgery on
 * a shader fails as a black object three scroll-beats into a sequence, which is
 * the worst possible place to find out.
 */

import { glassFragmentShader } from './glass'
import { warpChunk } from './warp'

function splice(source: string, anchor: string, replacement: string) {
  if (!source.includes(anchor)) {
    throw new Error(`portal-arrow: glassFragmentShader no longer contains ${JSON.stringify(anchor.slice(0, 48))}`)
  }
  return source.replace(anchor, replacement)
}

const OUTPUT = `  gl_FragColor = mix(
    vec4(color, alpha),
    vec4(highlight, alpha),
    clamp(uHighlightOnly, 0.0, 1.0)
  );`

export { glassVertexShader as portalArrowVertexShader } from './glass'

export const portalArrowFragmentShader = splice(
  splice(glassFragmentShader, 'void main() {', `${warpChunk}\n\nvoid main() {`),
  OUTPUT,
  `  // The arrow becoming the tunnel. Opaque as it goes, so the sticker field
  // and the closing screen's ground behind it stay hidden until it has shrunk
  // back to something you can see past.
  float portal = clamp(uPortal, 0.0, 1.0);
  color = mix(color, warpField(screenUv, uAspect), portal);
  alpha = mix(alpha, 1.0, portal);

  gl_FragColor = vec4(color, alpha);`,
)
