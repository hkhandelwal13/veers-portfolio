/**
 * The warp — line segments radiating from a single source, and the rings at
 * the peak.
 *
 * Every term is a function of scroll. Nothing advances on a clock: rays do not
 * stream outward on their own, they *appear* as you scroll, and they retract as
 * you scroll back. A time-driven field reads as a video playing behind the
 * page, which is the one thing this must not be — the whole sequence is
 * scrubbed, and the field has to be scrubbed with it.
 *
 * Two things follow from that. Ray count is a threshold against a per-ray
 * random, so more of them cross into existence the further in you are; and each
 * one's length grows with the same signal, so the field thickens and reaches
 * further at once.
 *
 * Computed inside the arrow's own fragment shader rather than rendered to an
 * FBO and masked. The arrow's geometry already is the mask: every fragment that
 * runs this is inside the silhouette by definition, so a separate target and a
 * stencil would buy the same picture for an extra full-screen pass.
 *
 * Sampled in screen space, not on the model's UVs, so the rays stay anchored to
 * the viewport's centre while the arrow spins and swells across them.
 */

export const warpChunk = /* glsl */ `
uniform float uRayDensity;   // 0..1 from scroll — how many rays, and how long
uniform float uRingStrength; // 0..1, the peak's rings
uniform vec3 uRayCool;       // cyan
uniform vec3 uRayMid;        // blue
uniform vec3 uRayHot;        // violet / magenta
uniform vec3 uRingColor;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

/**
 * One layer of segments.
 *
 * The angle around the centre is quantised into bins, and each bin's index
 * seeds its own random position, length, thickness and colour — so every ray is
 * independent without anything being stored.
 *
 * Thickness is measured perpendicular to the ray in screen units rather than in
 * bin widths. An angular width would make every segment fan out with distance,
 * so the outer field would read as wedges; the reference is line work, and line
 * work has one weight.
 */
vec3 warpLayer(float angle, float radius, float count, float seed, float density) {
  float index = floor(angle * count);
  float h = hash11(index + seed);
  float g = hash11(index + seed + 41.7);
  float k = hash11(index + seed + 91.3);

  // Whether this ray exists at all. Fading across a small band rather than a
  // hard step, so rays arrive as the scroll passes them instead of popping.
  float exists = smoothstep(density, density - 0.14, k);
  if (exists <= 0.001) return vec3(0.0);

  // Perpendicular distance to the ray's centre line, wrapped at the seam.
  float centre = (index + 0.5) / count;
  float delta = abs(angle - centre);
  delta = min(delta, 1.0 - delta);
  float perp = delta * 6.2831853 * radius;
  float halfWidth = 0.0011 + g * 0.0013;
  float line = smoothstep(halfWidth, halfWidth * 0.35, perp);

  // Each segment sits at its own radius and lengthens as the field fills.
  float start = 0.035 + h * 0.62;
  float len = (0.05 + g * 0.26) * (0.35 + density * 1.5);
  float radial =
    smoothstep(start, start + 0.006, radius) *
    (1.0 - smoothstep(start + len - 0.006, start + len, radius));

  // Weighted cool. The hot end is an accent — spread evenly it stops being a
  // field of light and becomes a colour wheel.
  vec3 tint = mix(uRayCool, uRayMid, h * 0.7);
  tint = mix(tint, uRayHot, step(0.84, g));
  // A share are plain white, which is what keeps it reading as light rather
  // than as a gradient.
  tint = mix(tint, vec3(1.0), step(0.76, k));

  return tint * line * radial * exists;
}

/** Concentric ellipses — the tunnel the manifesto sits inside. */
float warpRings(vec2 p) {
  if (uRingStrength <= 0.0) return 0.0;
  // Squashed vertically, so they read as circles seen at a shallow angle.
  float r = length(vec2(p.x, p.y * 2.4));
  // A thin line at the middle of each band. Two smoothsteps at opposite ends of
  // the same band can never both be non-zero, which is what the first attempt
  // did — the rings existed and were mathematically always black.
  float band = fract(r * 7.0);
  float ring = smoothstep(0.035, 0.0, abs(band - 0.5));
  return ring * (1.0 - smoothstep(0.12, 0.8, r)) * uRingStrength;
}

/** The whole field, in screen UV with the origin at the viewport centre. */
vec3 warpField(vec2 screenUv, float aspect) {
  if (uRayDensity <= 0.001) return vec3(0.0);

  vec2 p = screenUv - 0.5;
  p.x *= aspect;

  float radius = length(p);
  float angle = atan(p.y, p.x) / 6.2831853 + 0.5;

  vec3 rays = vec3(0.0);
  rays += warpLayer(angle, radius, 58.0, 3.1, uRayDensity);
  rays += warpLayer(angle, radius, 124.0, 61.7, uRayDensity);
  rays += warpLayer(angle, radius, 246.0, 127.3, uRayDensity);
  rays += warpLayer(angle, radius, 470.0, 211.9, uRayDensity);

  // No core glow. The source in the reference is a hole, not a lamp — the rays
  // read as coming *from* somewhere precisely because there is nothing there.
  return rays + uRingColor * warpRings(p);
}
`
