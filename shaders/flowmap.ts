/**
 * The flowmap — a velocity field the pointer stirs, held in a ping-pong pair of
 * low-resolution targets.
 *
 * Each frame this reads the previous field, drags it along its own velocity,
 * loses a little of it, adds whatever the pointer just did, and writes the
 * result to the other target. The pair then swaps. That feedback is the whole
 * simulation: there is no pressure solve here and there does not need to be —
 * nothing in the scene is incompressible, and a divergence-free field would
 * cost several passes to look no different once it is only being used to push
 * texture coordinates around.
 *
 * ── Packing ─────────────────────────────────────────────────────────────────
 * Velocity is stored signed, so it has to be encoded into 0..1. That is
 * necessary on the byte fallback and merely harmless on half-float, and the
 * gain from doing it unconditionally is that the fallback runs the same code
 * as everything else rather than a second path nobody looks at.
 *
 * ── Edges ───────────────────────────────────────────────────────────────────
 * Advection samples backwards along the velocity, which walks off the target
 * near its border. The targets clamp, so an off-edge sample returns the edge
 * texel — which, left alone, smears the border inward as a stripe. The fade at
 * the end of main() takes the field to zero in a band around the frame instead,
 * so there is nothing at the edge to smear.
 */

export const flowmapFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uPreviousFlow;
uniform vec2 uPointer;        // UV, origin bottom-left
uniform vec2 uVelocity;       // UV per second
uniform float uAspect;
uniform float uDissipation;
uniform float uReleaseDissipation;  // used once the pointer has gone
uniform float uRadius;
uniform float uSplatStrength;
uniform float uAdvectionStrength;
uniform float uSwirl;         // drag injected while the pointer is present
uniform vec2 uPullDirection;  // unit vector, held from the last real movement
uniform float uPresence;      // 0..1, eased — is the pointer over this section
uniform float uDelta;         // seconds, already clamped

varying vec2 vUv;

/**
 * Velocity the encoding can hold. Beyond it the field clips rather than wraps.
 *
 * Sized for a hard flick rather than for a normal movement: a ceiling that a
 * fast hand reaches is a ceiling you can see, because the smear stops growing
 * halfway through the gesture.
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
  // fluid came from, and take its velocity. Without it the splats sit still and
  // fade in place, which reads as a row of stamps rather than as flow.
  vec2 here = decodeFlow(texture2D(uPreviousFlow, vUv).rg);
  vec2 source = vUv - here * uDelta * uAdvectionStrength;
  vec2 previous = decodeFlow(texture2D(uPreviousFlow, clamp(source, 0.0, 1.0)).rg);

  // Two decay rates, blended by presence. While the pointer is there the field
  // has to hold long enough to fold into something; once it has gone the whole
  // thing has to be gone too, and at the holding rate a swirl deep enough to
  // pull a word apart is still visibly rippling seconds later.
  //
  // Raised to the frame's share of 1/60s, so both are per second rather than
  // per frame. A bare multiply makes the field's lifetime a function of the
  // frame rate: the same 0.93 clears in a fifth of a second at 60fps and takes
  // most of two at 8, which is the difference between a distortion that
  // releases and one that hangs there.
  float retention = mix(uReleaseDissipation, uDissipation, uPresence);
  previous *= pow(retention, uDelta * 60.0);

  // Aspect-corrected, so the splat is a circle on the screen rather than an
  // ellipse that changes shape when the window does.
  vec2 difference = vUv - uPointer;
  difference.x *= uAspect;

  float influence = exp(-dot(difference, difference) / max(uRadius, 0.0001));

  // Integrated over the frame rather than added whole. Adding the velocity
  // undivided makes the field twice as strong on a 120Hz screen as on a 60Hz
  // one, for the same movement of the same hand.
  vec2 next = previous + uVelocity * influence * uSplatStrength * uDelta;

  // Presence, not just movement.
  //
  // A field fed only by velocity is blank the moment the hand stops, so
  // holding the cursor somewhere does nothing. This keeps dragging under the
  // pointer for as long as it is there, in the direction it was last actually
  // moving, which dissipation then balances into a standing drag.
  //
  // A drag, specifically — not a vortex and not a sink. Rotation is what makes
  // a distortion read as waves: the field turns about a point and the picture
  // ripples in rings around it. A sink is worse: it is divergent, so advection
  // concentrates it into its own centre and cancels it, and what survives
  // magnifies rather than stretches — a magnified letterform is still a
  // legible letterform. A coherent push in one direction is what advection
  // pulls out into strands, and strands are what the letters and the stickers
  // come apart into.
  next += uPullDirection * influence * uSwirl * uPresence * uDelta;

  // Hold the border at rest so advection has nothing to drag inward.
  vec2 edge = min(vUv, 1.0 - vUv);
  float inset = smoothstep(0.0, 0.06, min(edge.x, edge.y));
  next *= inset;

  gl_FragColor = vec4(encodeFlow(next), 0.0, 1.0);
}
`

/** Matches FLOW_RANGE above — the compositor has to decode with the same one. */
export const FLOW_RANGE = 4.0
