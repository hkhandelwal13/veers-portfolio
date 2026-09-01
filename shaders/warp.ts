/**
 * The warp — rays travelling outward from a single source, and the rings at
 * the peak.
 *
 * Computed inside the arrow's own fragment shader rather than rendered to an
 * FBO and masked. The arrow's geometry already *is* the mask: every fragment
 * that runs this is inside the silhouette by definition, so a separate target
 * and a stencil would buy the same picture for an extra full-screen pass. The
 * one thing an FBO would add is the ability to blur or reuse the field, and
 * neither is wanted here.
 *
 * Sampled in screen space, not on the model's UVs, so the rays stay anchored to
 * the viewport's centre while the arrow spins and swells across them. On the
 * model's own coordinates they would rotate with it, and the source would stop
 * reading as a fixed point you are travelling toward.
 */

export const warpChunk = /* glsl */ `
uniform float uRayDensity;   // 0..1, how much of the field is drawn
uniform float uRingStrength; // 0..1, the peak's rings
uniform float uWarpTime;
uniform vec3 uRayCool;       // cyan end of the ramp
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
 * One layer of streaks.
 *
 * The angle around the centre is quantised into count bins, and each bin gets
 * its own random phase, speed and length from its index — so every ray is
 * independent without storing anything. travel wraps, which is what makes the
 * field continuous however long you sit in it: rays leave the outer edge and
 * reappear at the core rather than the whole layer restarting.
 */
vec3 warpLayer(float angle, float radius, float count, float seed, float time) {
  float index = floor(angle * count);
  float h = hash11(index + seed);
  float g = hash11(index + seed + 41.7);

  // Distance from this fragment to its ray's centre line, in bin widths.
  float centre = (index + 0.5) / count;
  float offset = abs(angle - centre) * count;
  float width = 0.05 + g * 0.09;
  float line = smoothstep(width, 0.0, offset);

  // The streak's own span, travelling outward and wrapping.
  float speed = 0.22 + h * 0.5;
  float start = fract(h * 7.31 + time * speed * 0.08);
  float length = 0.08 + g * 0.26;
  float radial =
    smoothstep(start, start + 0.015, radius) *
    (1.0 - smoothstep(start + length - 0.025, start + length, radius));

  vec3 tint = mix(uRayCool, uRayMid, h);
  tint = mix(tint, uRayHot, g * g);

  // Brighter near the source, as perspective would make them.
  float falloff = 0.35 + 0.65 * (1.0 - smoothstep(0.0, 0.9, radius));

  return tint * line * radial * falloff;
}

/** Concentric ellipses — the tunnel the manifesto sits inside. */
float warpRings(vec2 p, float time) {
  if (uRingStrength <= 0.0) return 0.0;
  // Squashed vertically, so they read as circles seen at a shallow angle.
  float r = length(vec2(p.x, p.y * 2.4));
  // A thin line at the middle of each band. Two smoothsteps at opposite ends
  // of the same band can never both be non-zero, which is what the first
  // attempt did — the rings existed and were mathematically always black.
  float band = fract(r * 7.0 - time * 0.12);
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
  rays += warpLayer(angle, radius, 46.0, 3.1, uWarpTime);
  rays += warpLayer(angle, radius, 92.0, 61.7, uWarpTime);
  rays += warpLayer(angle, radius, 168.0, 127.3, uWarpTime);

  // The source itself.
  rays += uRayCool * exp(-radius * 11.0) * 0.55;

  return rays * uRayDensity + uRingColor * warpRings(p, uWarpTime);
}
`
