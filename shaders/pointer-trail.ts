/**
 * The pixel trail — chunky neon blocks left behind the pointer.
 *
 * Drawn as instanced quads rather than as a fullscreen pass. A shader that
 * hunts for the nearest trail point runs that search for every pixel on the
 * screen; the trail is at most a few dozen cells, and drawing those few dozen
 * costs what they cover and nothing else.
 *
 * Each instance is one cell of a screen-anchored grid, so the blocks line up
 * with each other however the pointer moved — anchored to the screen rather
 * than to the trail, which is the same rule the dot matrix and the card reveal
 * follow, and the reason it reads as one shared grid rather than as a brush.
 */

export const pointerTrailVertexShader = /* glsl */ `
attribute float aAge;

varying float vAge;

void main() {
  vAge = aAge;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`

export const pointerTrailFragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uColor;
uniform float uStrength;

varying float vAge;

void main() {
  // Square-edged and quantised. The blocks step down through a few discrete
  // levels rather than fading smoothly, which is what keeps them reading as
  // pixels rather than as a soft tail.
  float fade = 1.0 - clamp(vAge, 0.0, 1.0);
  float stepped = floor(fade * 4.0 + 0.001) / 4.0;
  float alpha = stepped * uStrength;
  if (alpha <= 0.001) discard;

  gl_FragColor = vec4(uColor, alpha);

  #include <colorspace_fragment>
}
`
