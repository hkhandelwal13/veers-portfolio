/**
 * Screen → card-local UV mapping for DOM-mirrored images.
 *
 * The mesh is a fullscreen quad, so its own geometry carries no information
 * about where the card is. `uRect` does: xy is the rect's origin in normalized
 * screen space, zw its size. The fragment shader converts the screen UV it is
 * shading into coordinates local to that rect, samples the texture there, and
 * discards everything outside.
 *
 * Not moving geometry to match the DOM is the whole trick — CSS can change
 * columns, gaps and ratios freely, and WebGL only ever follows the resulting
 * rectangle.
 *
 * Phase 4 adds the dot-matrix reveal, the negative-to-positive develop, and the
 * scroll-velocity curl on top of this mapping. It stays a plain sample for now.
 */

export const domSyncVertexShader = /* glsl */ `
varying vec2 vScreenUv;

void main() {
  // The plane is 2x2 in local space, so its position IS clip space and its uv
  // runs 0..1 across the viewport from the bottom-left. The camera is bypassed
  // deliberately: this quad must cover the screen exactly, whatever the camera
  // is doing.
  vScreenUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const domSyncFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uMap;
uniform vec4 uRect;     // xy = origin (bottom-left), zw = size
uniform float uOpacity;

varying vec2 vScreenUv;

void main() {
  vec2 size = max(uRect.zw, vec2(1e-5));
  vec2 localUv = (vScreenUv - uRect.xy) / size;

  // Distance to the nearest edge on each axis; negative means outside.
  vec2 edge = min(localUv, 1.0 - localUv);
  float inside = step(0.0, edge.x) * step(0.0, edge.y);

  vec4 color = texture2D(uMap, clamp(localUv, 0.0, 1.0));
  color.a *= inside * uOpacity;

  if (color.a <= 0.001) discard;

  gl_FragColor = color;
}
`
