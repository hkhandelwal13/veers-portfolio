/**
 * The warp — a radial line field and the ring tunnel inside it.
 *
 * A full-screen pass now, not a chunk inside the arrow's material. The arrow
 * used to be the field's mask, which tied the two together: the rays could only
 * exist where the silhouette was, so they arrived as the arrow swelled and
 * vanished the instant it broke up. Separating them lets the arrow refract the
 * field while it is still glass and then dissolve out of the way of it.
 *
 * Every term is a function of scroll. Nothing advances on a clock: rays do not
 * stream outward on their own, they *appear* as you scroll, and they retract as
 * you scroll back. A time-driven field reads as a video playing behind the
 * page, which is the one thing this must not be.
 *
 * Three things carry the depth:
 *
 *   - the field thins outward. Each layer has a reach, and the fine layers
 *     reach barely past the centre, so hundreds of short lines crowd the
 *     vanishing point and only a few long ones make the corners. A field that
 *     is evenly dense everywhere reads as a starburst decal.
 *   - segments stretch with distance. The same line covers more screen the
 *     further it has travelled from the centre.
 *   - the rings are emitted one per step of scroll and expand geometrically,
 *     which is what a ring of fixed radius does as it comes toward you.
 */

export const warpVertexShader = /* glsl */ `
varying vec2 vScreenUv;

void main() {
  // The plane is 2x2 in local space, so its position IS clip space. The camera
  // is bypassed deliberately: this quad must cover the screen exactly.
  vScreenUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const warpFragmentShader = /* glsl */ `
precision highp float;

uniform float uDensity;    // 0..1 from scroll — how many rays, and how long
uniform float uRingPhase;  // rings emitted so far; the fraction is the newest
uniform float uRoom;       // 0..1 — how far the dark room has closed in
uniform float uFine;       // 1 to draw the two finest layers, 0 to skip them
uniform vec3 uRoomColor;
uniform float uAspect;
uniform vec3 uRayCool;     // cyan
uniform vec3 uRayMid;      // blue
uniform vec3 uRayHot;      // violet / magenta
uniform vec3 uRingColor;

varying vec2 vScreenUv;

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
 * seeds its own position, length, thickness and colour — so every ray is
 * independent without anything being stored.
 *
 * The reach is how far out this layer's rays survive. It is what turns a flat
 * starburst into a tunnel: the 480-bin layer dies just past the middle, so its
 * rays only ever crowd the vanishing point, while the 46-bin layer runs to the
 * corners and gives the field its long streaks.
 *
 * Thickness is measured perpendicular to the ray in screen units rather than in
 * bin widths. An angular width would make every segment fan out with distance,
 * so the outer field would read as wedges; the reference is line work, and line
 * work has one weight.
 */
vec3 warpLayer(float angle, float radius, float count, float seed, float reach) {
  float index = floor(angle * count);
  float h = hash11(index + seed);
  float g = hash11(index + seed + 41.7);
  float k = hash11(index + seed + 91.3);

  float local = uDensity * (1.0 - smoothstep(reach * 0.3, reach, radius));
  // Fading across a band rather than a hard step, so rays arrive as the scroll
  // passes them instead of popping.
  float exists = smoothstep(local, local - 0.16, k);
  if (exists <= 0.001) return vec3(0.0);

  // Perpendicular distance to the ray's centre line, wrapped at the seam.
  float centre = (index + 0.5) / count;
  float delta = abs(angle - centre);
  delta = min(delta, 1.0 - delta);
  float perp = delta * 6.2831853 * radius;
  float halfWidth = 0.0019 + g * 0.0026;
  float line = smoothstep(halfWidth, halfWidth * 0.3, perp);

  // Each segment sits at its own radius, lengthens as the field fills, and
  // stretches with how far out it already is.
  float start = 0.03 + h * 0.7;
  float len = (0.045 + g * 0.17) * (0.3 + uDensity * 1.2) * (0.35 + start * 1.2);
  float radial =
    smoothstep(start, start + 0.005, radius) *
    (1.0 - smoothstep(start + len - 0.02, start + len, radius));

  // Weighted cool. The hot end is an accent — spread evenly it stops being a
  // field of light and becomes a colour wheel.
  vec3 tint = mix(uRayCool, uRayMid, h * 0.7);
  tint = mix(tint, uRayHot, step(0.84, g));
  // A share are plain white, which is what keeps it reading as light rather
  // than as a gradient.
  tint = mix(tint, vec3(1.0), step(0.76, k));

  return tint * line * radial * exists;
}

/**
 * The ring tunnel.
 *
 * One ring per whole step of uRingPhase, each born at the centre and expanding
 * geometrically from there — which is what a ring of fixed size does as it
 * comes toward you, and why they crowd near the middle and race apart at the
 * edges. Scrolling back lowers the phase and takes them away in the order they
 * arrived.
 */
float warpRings(vec2 p) {
  if (uRingPhase <= 0.0) return 0.0;

  // Squashed vertically, so they read as circles seen at a shallow angle.
  float r = length(vec2(p.x, p.y * 2.4));
  float total = 0.0;

  for (int i = 0; i < 8; i++) {
    float age = uRingPhase - float(i);
    if (age <= 0.0) continue;

    float radius = 0.05 * pow(2.0, age);
    // Barely wider as it nears — enough that the outer rings do not thin into
    // aliasing, nowhere near enough to become a band. The reference draws
    // these as hairlines and the tunnel depends on it: a thick ring stops
    // reading as a circle at distance and starts reading as a painted ellipse.
    float w = 0.0022 + radius * 0.005;
    float ring = smoothstep(w, 0.0, abs(r - radius));

    total += ring * smoothstep(0.0, 0.3, age) * (1.0 - smoothstep(0.75, 1.3, radius));
  }

  return total;
}

void main() {
  vec2 p = vScreenUv - 0.5;
  p.x *= uAspect;

  float radius = length(p);
  float angle = atan(p.y, p.x) / 6.2831853 + 0.5;

  vec3 rays = vec3(0.0);
  if (uDensity > 0.001) {
    rays += warpLayer(angle, radius, 64.0, 3.1, 1.5);
    rays += warpLayer(angle, radius, 150.0, 61.7, 0.85);
    // The fine layers are the crowd at the vanishing point, and they are also
    // most of the cost — a small screen keeps the tunnel and drops the crowd.
    if (uFine > 0.5) {
      rays += warpLayer(angle, radius, 320.0, 127.3, 0.42);
      rays += warpLayer(angle, radius, 640.0, 211.9, 0.22);
    }
  }

  // No core glow. The source in the reference is a hole, not a lamp — the rays
  // read as coming *from* somewhere precisely because there is nothing there.
  vec3 color = uRoomColor * uRoom + rays + uRingColor * warpRings(p);

  // Premultiplied, which is what lets one draw be both things at once: with
  // uRoom at 0 the destination survives untouched and the rays simply add, and
  // with it at 1 the room replaces whatever ground the theme had put there.
  // Two passes would buy the same picture for a second full-screen quad.
  gl_FragColor = vec4(color, uRoom);

  #include <colorspace_fragment>
}
`
