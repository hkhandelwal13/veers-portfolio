/**
 * The dissolve rule, shared by everything in the hero that leaves on scroll.
 *
 * The article's principle: continuous progress becomes the size of a shape on a
 * fixed grid. Here it is a circle per screen cell — shrinking, for objects
 * breaking up, and growing, for the ground handing over to the next section.
 * Same language as the card hover and the route wipe, different geometry.
 */

/** Fragment shaders only: fwidth is a screen-space derivative. */
export const dissolveChunk = /* glsl */ `
/**
 * One circle per screen cell, shrinking as progress rises.
 *
 * 0.78 rather than 0.5: a circle only covers its square cell once its radius
 * reaches half the diagonal, so anything less leaves the corners showing and
 * the object is already dotted before the dissolve has started.
 */
float dotMatrixMask(vec2 fragCoord, float progress, float cellPx) {
  if (progress <= 0.0) return 1.0;

  vec2 cell = fract(fragCoord / cellPx);
  float dist = distance(cell, vec2(0.5));
  float radius = mix(0.78, 0.0, clamp(progress, 0.0, 1.0));
  float aa = fwidth(dist) * 1.5;

  return 1.0 - smoothstep(radius - aa, radius + aa, dist);
}

/** The same circles, growing instead — one surface handing over to another. */
float dotMatrixWipe(vec2 fragCoord, float progress, float cellPx) {
  // At radius zero the antialiasing band still straddles the cell centre, and
  // smoothstep returns 0.5 there — a half-strength dot in every cell, before
  // the wipe has started. Across a 7px grid that is a fine even veil over the
  // whole hero, which is exactly the tint that appeared on scroll.
  if (progress <= 0.0) return 0.0;

  vec2 cell = fract(fragCoord / cellPx);
  float dist = distance(cell, vec2(0.5));
  float radius = mix(0.0, 0.8, clamp(progress, 0.0, 1.0));
  float aa = fwidth(dist) * 1.5;

  return 1.0 - smoothstep(radius - aa, radius + aa, dist);
}
`
