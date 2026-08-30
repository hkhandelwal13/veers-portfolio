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
 * Phase 4 layers the dot-matrix hover reveal on top of that mapping. The
 * develop-on-enter and scroll-velocity curl are still to come.
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

uniform sampler2D uMap;        // base — the poster
uniform sampler2D uMapReveal;  // what the reveal uncovers
uniform vec4 uRect;            // xy = origin (bottom-left), zw = size
uniform float uOpacity;
uniform float uRevealProgress; // 0..1
uniform float uCellPx;         // dot-matrix cell size, CSS px
uniform vec2 uViewportPx;      // viewport size, CSS px

varying vec2 vScreenUv;

void main() {
  vec2 size = max(uRect.zw, vec2(1e-5));
  vec2 localUv = (vScreenUv - uRect.xy) / size;

  // Distance to the nearest edge on each axis; negative means outside.
  vec2 edge = min(localUv, 1.0 - localUv);
  float inside = step(0.0, edge.x) * step(0.0, edge.y);

  vec4 base = texture2D(uMap, clamp(localUv, 0.0, 1.0));

  // --- Dot-matrix reveal --------------------------------------------------
  // The wave spreads from the centre of the CARD, so the distance is measured
  // in card-local space with the card's aspect folded in — without that, the
  // wavefront is an ellipse on a 16:9 card and reaches the side edges long
  // before the top and bottom.
  float aspect = (size.x * uViewportPx.x) / max(size.y * uViewportPx.y, 1e-5);
  vec2 centered = localUv * 2.0 - 1.0;
  centered.x *= aspect;
  float distToCenter = length(centered);

  // Reach the far corner exactly at progress 1, with a little overshoot so the
  // trailing feather clears the corner too.
  float maxRadius = length(vec2(aspect, 1.0));
  float feather = 0.14;
  float radius = clamp(uRevealProgress, 0.0, 1.0) * (maxRadius + feather * 2.0);
  float grow = 1.0 - smoothstep(radius - feather, radius + feather, distToCenter);
  // Kill any residue at rest, so an idle card is exactly the base texture.
  grow *= step(0.001, uRevealProgress);

  // The cells are anchored to the SCREEN, not the card. That is what makes the
  // grid feel like one shared matrix laid over the page rather than a texture
  // belonging to each card, and it is the same rule the loader and page
  // transitions follow.
  vec2 cellSizeUv = vec2(max(uCellPx, 2.0)) / max(uViewportPx, vec2(1.0));
  vec2 cellUv = fract(vScreenUv / cellSizeUv);
  float squareDist = max(abs(cellUv.x - 0.5), abs(cellUv.y - 0.5));

  // Each cell's square grows from nothing to slightly MORE than filling its
  // cell. The overshoot matters: stopping at exactly 0.5 leaves a hairline of
  // base texture at every cell boundary, so a fully revealed card keeps a grid
  // stamped over it forever. Past 0.5 the squares close up and the matrix is
  // visible only while the reveal is actually moving.
  float extent = mix(0.0, 0.58, grow);
  float aa = max(fwidth(squareDist), 1e-4);
  float squareMask = 1.0 - smoothstep(extent - aa, extent + aa, squareDist);

  vec4 revealed = texture2D(uMapReveal, clamp(localUv, 0.0, 1.0));
  vec4 color = mix(base, revealed, squareMask);

  color.a *= inside * uOpacity;

  if (color.a <= 0.001) discard;

  gl_FragColor = color;
}
`
