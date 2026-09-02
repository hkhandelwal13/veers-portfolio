/**
 * The warp — the tunnel the arrow opens onto.
 *
 * A chunk, included in the arrow's own fragment shader rather than drawn as a
 * fullscreen pass. The arrow's silhouette IS the mask: every fragment that runs
 * this is inside it by definition, so the field lives in the arrow while it is
 * small, fills the frame once the arrow is past every edge, and shrinks back
 * into it on the way out. A separate fullscreen quad has to be told where the
 * arrow is; this cannot disagree with it.
 *
 * Everything is a function of scroll — there is no clock anywhere. But it does
 * MOVE: uTravel is a distance down the tunnel, not a threshold, so scrolling
 * down carries the segments outward from the black centre and scrolling up
 * carries them back into it. That is the difference between a field that fills
 * in as you scroll and one you are travelling through.
 *
 * The perspective is done by hand in 2D. A segment at depth z projects to
 * screen radius ~1/z, so one that is far away is a short stub near the
 * vanishing point and the same segment near the camera is a long streak at the
 * frame edge. fract() recycles depth, which is what makes the tunnel endless in
 * both directions without a particle buffer.
 */

export const warpChunk = /* glsl */ `
uniform float uRayDensity;  // 0..1 from scroll — how many rays exist at all
uniform float uTravel;      // distance down the tunnel, from scroll
uniform float uRingPhase;   // rings emitted so far; the fraction is the newest
uniform float uRingLive;    // how many of the slots are still drawn
uniform float uPortal;      // 0 = the arrow is glass, 1 = it is the tunnel
uniform float uAspect;
uniform float uFine;        // 1 to draw the two finest layers, 0 to skip them
uniform vec3 uRayCool;      // cyan
uniform vec3 uRayMid;       // blue
uniform vec3 uRayHot;       // violet / magenta
uniform vec3 uRingColor;

/** The hole everything comes out of, as a share of the frame's height. */
const float CORE_RADIUS = 0.055;

/** Radial lines in the field. Every segment sits on one of them. */
const float RAY_COUNT = 520.0;
/** How much of its bin a segment may fill. The rest is the gap to its neighbour. */
const float BIN_FILL = 0.34;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

/**
 * One pass of segments over the shared angular partition.
 *
 * ONE partition, called several times with different seeds. Every pass uses the
 * same bin boundaries, so every segment sits on the same set of radial centre
 * lines and no two can ever cross: what the extra passes add is more segments
 * along a line, at their own depths, not more lines. Bins of different sizes —
 * which is what several layers at different counts would be — put rays at
 * angles that fall between other rays' angles, and near the centre, where a bin
 * is a fraction of a degree wide, they lie on top of each other.
 *
 * Thickness is measured perpendicular to the ray in screen units, so a segment
 * has one weight along its whole length rather than fanning out into a wedge.
 * It is then capped at a share of its own bin, which is what guarantees a gap
 * between neighbours — and, because a bin's arc is proportional to the radius,
 * is also what makes the field hairline-fine at the core and heavy at the edge
 * without a second curve to tune.
 */
vec3 warpLayer(float angle, float radius, float count, float seed) {
  float index = floor(angle * count);
  float h = hash11(index + seed);
  float g = hash11(index + seed + 41.7);
  float k = hash11(index + seed + 91.3);

  // Whether this ray exists at all. Fading across a band rather than a hard
  // step, so rays arrive as the scroll passes them instead of popping.
  float exists = smoothstep(uRayDensity, uRayDensity - 0.18, k);
  if (exists <= 0.001) return vec3(0.0);

  // Down the tunnel. Each ray runs at its own rate, or the whole field pulses
  // in step and reads as one object breathing rather than as many going past.
  float zPhase = fract(h + uTravel * (0.72 + g * 0.62));

  // Hand-rolled perspective: how far out the segment's inner end has travelled.
  //
  // Not a literal 1/z. Depth spread evenly through a real frustum puts about
  // 97% of the field inside the middle tenth of the screen and leaves the
  // corners bare — the reference is dense to the edges. The exponent is the
  // compromise: still accelerating outward, so the rush is there, but with
  // enough of the field in the outer half to fill it.
  float travelled = 1.16 * pow(zPhase, 1.6);
  // Offset by the core. Rays are born at the edge of a hole rather than at a
  // point: the reference's centre is empty for a good fraction of the frame,
  // and that emptiness is what the whole field appears to be coming out of.
  float start = CORE_RADIUS + travelled;
  // Length and weight follow it. The same segment covers more screen and reads
  // heavier the nearer it gets, which is most of what sells the depth.
  float len = (0.26 + g * 0.34) * (0.05 + travelled * 1.7);
  float halfWidth = 0.0010 + 0.0092 * min(travelled, 1.0);

  // Perpendicular distance to the ray's centre line, wrapped at the seam.
  float centre = (index + 0.5) / count;
  float delta = abs(angle - centre);
  delta = min(delta, 1.0 - delta);
  float perp = delta * 6.2831853 * radius;

  // Never wider than its own share of the bin, so neighbours always have a gap
  // between them however heavy the ramp above asks for.
  float binHalfWidth = 3.1415927 * radius / count;
  float weight = min(halfWidth, binHalfWidth * BIN_FILL);
  float line = smoothstep(weight, weight * 0.3, perp);

  float radial =
    smoothstep(start, start + 0.004, radius) *
    (1.0 - smoothstep(start + len - 0.015, start + len, radius));

  // Weighted cool. The hot end is an accent — spread evenly it stops being a
  // field of light and becomes a colour wheel.
  vec3 tint = mix(uRayCool, uRayMid, h * 0.75);
  tint = mix(tint, uRayHot, step(0.86, g));
  // A share are plain white, which is what keeps it reading as light rather
  // than as a gradient.
  tint = mix(tint, vec3(1.0), step(0.8, k));

  // Dimmer where it is born. A segment at the far end is a couple of pixels
  // from the vanishing point and there are hundreds of them; at full strength
  // they pile into a bright lamp exactly where the reference has a hole.
  float birth = smoothstep(0.0, 0.13, zPhase);

  return tint * line * radial * exists * birth;
}

/** How wide the ball of rings is, and how tall, as a share of the frame. */
const float RING_RADIUS = 0.21;
const float RING_HEIGHT = 0.86;
/** Seen almost edge-on, which is what turns each circle into a flat ellipse. */
const float RING_SQUASH = 0.1;
/** Slots on the conveyor, and how many steps a ring takes to cross the ball. */
const int RING_SLOTS = 6;
const float RING_LIFE = 6.0;

/**
 * The ring tunnel: the latitudes of a ball, arriving one at a time.
 *
 * Each ring enters at the top, travels down through the ball as the scroll
 * advances, and leaves at the bottom — so its width follows the ball's
 * silhouette, widest as it crosses the equator and closing to nothing at either
 * pole. That is why they read as a solid object made of outlines rather than as
 * concentric circles, which is what a set of rings sharing a centre would give.
 *
 * Six slots on a conveyor: a slot's ring is born when the phase reaches it, so
 * they fill in one by one at the start, and recycles forever after. Both ends
 * of the run have zero width, so the recycle is invisible.
 */
float warpRings(vec2 p) {
  if (uRingLive <= 0.0) return 0.0;

  float total = 0.0;

  for (int i = 0; i < RING_SLOTS; i++) {
    // Slots fill in one at a time on the way in and empty one at a time on the
    // way out — uRingLive is the count, and it runs up and back down.
    float alive = smoothstep(float(i), float(i) + 0.7, uRingLive);
    if (alive <= 0.002) continue;

    float age = uRingPhase - float(i);
    if (age <= 0.0) continue;

    // -1 at the top of the ball, +1 at the bottom.
    float v = -1.0 + mod(age, RING_LIFE) * (2.0 / RING_LIFE);

    // The chord of the ball at this latitude.
    float a = RING_RADIUS * sqrt(max(0.0, 1.0 - v * v));
    if (a < 0.002) continue;
    float b = a * RING_SQUASH;
    float cy = -v * RING_RADIUS * RING_HEIGHT;

    // Signed distance to the ellipse, in screen units. Dividing by the
    // gradient is what keeps the line one weight all the way round: without it
    // the flat top and bottom arcs come out several times thicker than the
    // ends.
    vec2 q = vec2(p.x / a, (p.y - cy) / b);
    float ql = length(q);
    vec2 grad = vec2(q.x / a, q.y / b);
    float dist = (ql - 1.0) * ql / max(length(grad), 1e-5);

    total += smoothstep(0.0022, 0.0, abs(dist)) * alive;
  }

  return total;
}

/** The whole field, in screen UV with the origin at the viewport centre. */
vec3 warpField(vec2 screenUv, float aspect) {
  vec2 p = screenUv - 0.5;
  p.x *= aspect;

  float radius = length(p);
  float angle = atan(p.y, p.x) / 6.2831853 + 0.5;

  vec3 rays = vec3(0.0);
  if (uRayDensity > 0.001) {
    // Three passes over the one partition: up to three segments on a line, at
    // their own depths, and never a crossing.
    rays += warpLayer(angle, radius, RAY_COUNT, 3.1);
    rays += warpLayer(angle, radius, RAY_COUNT, 61.7);
    // The third is the crowd, and the single biggest cost — a small screen
    // keeps the tunnel and drops it.
    if (uFine > 0.5) {
      rays += warpLayer(angle, radius, RAY_COUNT, 127.3);
    }
  }

  // No core glow. The source in the reference is a hole, not a lamp — the rays
  // read as coming *from* somewhere precisely because there is nothing there.
  return rays + uRingColor * warpRings(p);
}
`
