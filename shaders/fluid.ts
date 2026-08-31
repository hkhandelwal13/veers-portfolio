/**
 * Shared GLSL for the hero's two screen-space rules.
 *
 * `rippleOffset` is the fluid distortion: the pointer's wake, as a UV
 * displacement. The backdrop displaces its pattern with it, the stickers
 * displace their vertices with it, and the glass adds it to the direction it
 * refracts along — so one gesture moves the whole hero rather than each layer
 * reacting on its own.
 *
 * `dotMatrixMask` is the dissolve: the article's rule that continuous progress
 * becomes the size of a shape on a fixed grid, here a circle per screen cell
 * shrinking to nothing. Same language as the card hover and the route wipe,
 * different geometry — which is the point.
 */

export const RIPPLE_COUNT = 8

/**
 * The wake. Safe in a vertex shader as well as a fragment one — the stickers
 * displace their whole quad by it, which has to happen before rasterisation.
 */
export const rippleChunk = /* glsl */ `
#define RIPPLE_COUNT ${RIPPLE_COUNT}

uniform vec2 uRippleCenter[RIPPLE_COUNT];
uniform float uRippleAge[RIPPLE_COUNT];
uniform float uRippleLife;
uniform float uRippleAmp;
uniform float uAspect;

/**
 * The pointer's wake as a UV offset.
 *
 * Each ripple is a ring travelling outward — sin(distance * freq - age * speed),
 * with the phase running backwards in age, so crests move away from where the
 * pointer was. Two falloffs keep it local and finite — exponential in distance,
 * quadratic in remaining life.
 *
 * x is scaled by the aspect ratio before measuring, or the rings come out as
 * ellipses on any viewport that is not square.
 */
vec2 rippleOffset(vec2 uv) {
  vec2 total = vec2(0.0);

  for (int i = 0; i < RIPPLE_COUNT; i++) {
    float age = uRippleAge[i];
    if (age >= uRippleLife) continue;

    vec2 delta = uv - uRippleCenter[i];
    delta.x *= uAspect;
    float dist = length(delta);
    if (dist < 1e-5) continue;

    float life = 1.0 - age / uRippleLife;
    float ring = sin(dist * 34.0 - age * 9.0);
    float falloff = exp(-dist * 7.0) * life * life;

    total += (delta / dist) * ring * falloff;
  }

  return total * uRippleAmp;
}
`

/**
 * The dissolve. Fragment shaders only: fwidth is a screen-space derivative and
 * does not exist during vertex processing.
 */
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
`
