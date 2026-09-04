/**
 * The flowmap — a velocity field the pointer stamps into, held in a ping-pong
 * pair of low-resolution targets.
 *
 * This is OGL's Flowmap, rewritten against three.js. Not the library — OGL
 * carries its own WebGL context and cannot see this scene's framebuffer, so it
 * could not distort it — but its algorithm, which is what the look people mean
 * by "the OGL fluid" actually comes from. The difference from the more common
 * formulation is one operator, and it is the whole character of the effect:
 *
 *   accumulating   next = previous + velocity * gaussian
 *   stamping       next = mix(previous, velocity, falloff)
 *
 * Accumulating builds a soft hill of velocity that keeps growing while the
 * pointer sits in it and bleeds away at its edges. The picture rides over the
 * shoulders of that hill, and riding over a smooth hill is what waves look
 * like. Stamping REPLACES the field under the cursor with the stamp: inside
 * the falloff every texel carries the same vector, so the picture there is
 * bodily displaced as one piece rather than bent, and only the rim — where the
 * stamp blends back into the advected history — is where anything curves.
 *
 * That is the difference between a ripple passing through the letters and the
 * letters being dragged.
 *
 * Everything is a function of scroll and pointer; nothing runs on a clock.
 */

export const flowmapFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uPreviousFlow;
uniform vec2 uPointer;        // UV, origin bottom-left
uniform vec2 uStamp;          // the vector written under the cursor
uniform float uAspect;
uniform float uRadius;        // falloff radius, in UV
uniform float uDissipation;
uniform float uReleaseDissipation;
uniform float uPresence;      // 0..1, eased — is the pointer over this section
uniform float uAdvectionStrength;
uniform float uDelta;         // seconds, already clamped

varying vec2 vUv;

/**
 * Velocity the encoding can hold.
 *
 * Signed values have to be packed into 0..1 — necessary on the byte fallback
 * where half-float is not renderable, and harmless on half-float. Doing it
 * unconditionally means the fallback runs the same code as everything else
 * rather than a second path nobody looks at.
 */
const float FLOW_RANGE = 8.0;

vec2 decodeFlow(vec2 packed) {
  return (packed * 2.0 - 1.0) * FLOW_RANGE;
}

vec2 encodeFlow(vec2 flow) {
  return clamp(flow / FLOW_RANGE, -1.0, 1.0) * 0.5 + 0.5;
}

void main() {
  // Semi-Lagrangian advection: look back along the field to where this texel's
  // fluid came from, and take its velocity. This is what pulls the stamp out
  // into strands behind the cursor instead of leaving a moving blob.
  vec2 here = decodeFlow(texture2D(uPreviousFlow, vUv).rg);
  vec2 source = vUv - here * uDelta * uAdvectionStrength;
  vec2 previous = decodeFlow(texture2D(uPreviousFlow, clamp(source, 0.0, 1.0)).rg);

  // Two decay rates, blended by presence. While the pointer is there the field
  // has to hold long enough to draw strands; once it has gone the whole thing
  // has to be gone too.
  //
  // Raised to the frame's share of 1/60s, so both are per second rather than
  // per frame. A bare multiply makes the field's lifetime a function of the
  // frame rate: the same 0.93 clears in a fifth of a second at 60fps and takes
  // most of two at 8.
  float retention = mix(uReleaseDissipation, uDissipation, uPresence);
  previous *= pow(retention, uDelta * 60.0);

  // Aspect-corrected, so the stamp is a circle on the screen rather than an
  // ellipse that changes shape when the window does.
  vec2 cursor = vUv - uPointer;
  cursor.x *= uAspect;

  float falloff = smoothstep(uRadius, 0.0, length(cursor));

  vec2 next = mix(previous, uStamp, falloff);

  // Hold the border at rest so advection has nothing to drag inward. Advection
  // samples backwards along the velocity, which walks off the target near its
  // edge; the targets clamp, and a clamped off-edge sample smears the border
  // inward as a stripe.
  vec2 edge = min(vUv, 1.0 - vUv);
  next *= smoothstep(0.0, 0.06, min(edge.x, edge.y));

  gl_FragColor = vec4(encodeFlow(next), 0.0, 1.0);
}
`
