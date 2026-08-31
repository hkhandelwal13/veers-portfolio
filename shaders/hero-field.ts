import { dissolveChunk, rippleChunk } from './fluid'

/**
 * The hero's ground, in WebGL rather than CSS.
 *
 * It exists for two reasons the CSS version cannot serve:
 *
 *  1. The glass refracts a *texture of the scene*, and CSS is not in that
 *     texture. With the ground painted by the page, the refraction pass had
 *     nothing behind the word but a flat clear colour — which is why the
 *     background never appeared to bend through it.
 *  2. A shader can be displaced. The pointer's wake moves this pattern, and
 *     because the glass then refracts the moved pattern, one gesture ripples
 *     the background and the word together.
 *
 * It draws the same blueprint grid and diagonal light as the CSS dressing, from
 * the same tokens, so the two match where they meet.
 */

export const heroFieldVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const heroFieldFragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uGround;      // --bg
uniform vec3 uGroundEnd;   // what the section below is painted in
uniform vec4 uGridMark;    // rgb + alpha, from --grid-mark
uniform vec4 uStreakGlow;
uniform vec4 uStreakBand;

uniform vec2 uResolution;  // framebuffer pixels
uniform float uCellPx;     // grid pitch, --grid-cell
uniform float uDotPx;      // dot-matrix pitch for the dissolve
uniform float uTime;
uniform float uProgress;   // hero scroll progress, 0..1

varying vec2 vUv;

${rippleChunk}
${dissolveChunk}

/** Hairlines plus a crosshair at each intersection — the CSS tile, in maths. */
float gridMask(vec2 px) {
  vec2 cell = mod(px, uCellPx) - uCellPx * 0.5;
  vec2 d = abs(cell);

  float lines = max(
    1.0 - smoothstep(0.0, 1.2, d.x),
    1.0 - smoothstep(0.0, 1.2, d.y)
  ) * 0.4;

  // The cross is the same two rules, clipped to a short span around the centre.
  float crossArm = 7.0;
  float cross = max(
    (1.0 - smoothstep(0.0, 1.2, d.x)) * step(d.y, crossArm),
    (1.0 - smoothstep(0.0, 1.2, d.y)) * step(d.x, crossArm)
  );

  return max(lines, cross);
}

/** Soft diagonal bands, drifting. Matches the CSS repeating-linear-gradient. */
float streakMask(vec2 uv) {
  float angle = 2.0;  // ~114deg, as in the CSS
  vec2 dir = vec2(cos(angle), sin(angle));
  float t = dot(uv * vec2(uAspect, 1.0), dir) * 3.4 + uTime * 0.012;
  float band = fract(t);
  // Wide, soft stops rather than hard edges.
  return smoothstep(0.0, 0.45, band) * (1.0 - smoothstep(0.45, 1.0, band));
}

void main() {
  vec2 px = gl_FragCoord.xy;

  // Screen UV, not the plane's own: the plane is seated on the hero section's
  // rect and scrolls with it, but the wake and the grid are viewport-anchored —
  // sampling in local UV would slide the whole pattern as the page moves.
  vec2 screenUv = vec2(px.x / uResolution.x, 1.0 - px.y / uResolution.y);

  // Everything patterned is sampled through the wake, so the ground reads as a
  // surface with something moving under it rather than as a flat backdrop.
  vec2 offset = rippleOffset(screenUv);
  vec2 uv = screenUv + offset;
  vec2 warpedPx = px + vec2(offset.x, -offset.y) * uResolution;

  // The ground itself travels toward the next section's colour, so the handover
  // has already happened by the time that section arrives.
  vec3 color = mix(uGround, uGroundEnd, smoothstep(0.1, 0.95, uProgress));

  // Grid and light fade out as the dot matrix takes over.
  float dressing = 1.0 - smoothstep(0.0, 0.6, uProgress);

  float glow = exp(-length((uv - vec2(0.16, -0.06)) * vec2(uAspect, 1.0)) * 2.1);
  color += uStreakGlow.rgb * uStreakGlow.a * glow * dressing;
  color += uStreakBand.rgb * uStreakBand.a * streakMask(uv) * 0.5 * dressing;
  color += uGridMark.rgb * uGridMark.a * gridMask(warpedPx) * dressing;

  // ...and the matrix rises, then leaves with the hero.
  //
  // The mask itself, not its inverse: the mask is the circle, and the circle is
  // the dot. Painting 1 - mask paints the gaps between them, which as the
  // circles shrink means painting very nearly the whole screen.
  float dots = dotMatrixMask(warpedPx, uProgress, uDotPx);
  float dotStrength =
    smoothstep(0.05, 0.45, uProgress) * (1.0 - smoothstep(0.7, 1.0, uProgress));
  color += uGridMark.rgb * uGridMark.a * dots * dotStrength * 1.5;

  gl_FragColor = vec4(color, 1.0);

  #include <colorspace_fragment>
}
`
