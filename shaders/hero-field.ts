import { dissolveChunk } from './fluid'

/**
 * The hero's ground, in WebGL rather than CSS.
 *
 * It exists for two reasons the CSS version cannot serve:
 *
 *  1. The glass refracts a *texture of the scene*, and CSS is not in that
 *     texture. With the ground painted by the page, the refraction pass had
 *     nothing behind the word but a flat clear colour — which is why the
 *     background never appeared to bend through it.
 *  2. It has to hand over to the next section. The ground travels into a
 *     dot-matrix wipe on scroll, so the black (or white) the editor intro
 *     paints in has already arrived by the time that section does.
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

uniform vec2 uResolution;   // framebuffer pixels
uniform float uCellPx;      // grid pitch, --grid-cell
uniform float uDotPx;       // dot-matrix pitch for the handover
uniform float uTime;
uniform float uProgress;    // hero scroll progress, 0..1
uniform float uPixelRatio;  // device pixels per CSS pixel
uniform float uAspect;

varying vec2 vUv;

${dissolveChunk}

/** Hairlines plus a crosshair at each intersection — the CSS tile, in maths. */
float gridMask(vec2 px) {
  vec2 cell = mod(px, uCellPx) - uCellPx * 0.5;
  vec2 d = abs(cell);

  // Crisper than the CSS tile's soft 0.4: the ask was for the lines to read
  // more clearly, not for more ink on the page.
  float lines = max(
    1.0 - smoothstep(0.0, 0.9, d.x),
    1.0 - smoothstep(0.0, 0.9, d.y)
  ) * 0.62;

  // The cross is the same two rules, clipped to a short span around the centre.
  float crossArm = 7.0;
  float cross = max(
    (1.0 - smoothstep(0.0, 0.9, d.x)) * step(d.y, crossArm),
    (1.0 - smoothstep(0.0, 0.9, d.y)) * step(d.x, crossArm)
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
  // CSS pixels. The grid pitch and the dot pitch are both design measures, and
  // gl_FragCoord is in device pixels — dividing by the ratio is what stops a
  // retina screen drawing both at half the size they were specified at.
  vec2 px = gl_FragCoord.xy / uPixelRatio;
  vec2 screenUv = vec2(
    gl_FragCoord.x / uResolution.x,
    1.0 - gl_FragCoord.y / uResolution.y
  );

  vec3 color = uGround;

  // The dressing fades out ahead of the handover, so the wipe lands on a clean
  // ground rather than on a grid it then has to cover.
  float dressing = 1.0 - smoothstep(0.05, 0.5, uProgress);

  float glow = exp(-length((screenUv - vec2(0.16, -0.06)) * vec2(uAspect, 1.0)) * 2.1);
  color += uStreakGlow.rgb * uStreakGlow.a * glow * dressing;
  color += uStreakBand.rgb * uStreakBand.a * streakMask(screenUv) * 0.5 * dressing;
  color += uGridMark.rgb * uGridMark.a * gridMask(px) * dressing;

  // The handover, as the same dot-matrix rule used everywhere else: a circle
  // per cell, growing in the *next section's* colour until the circles merge
  // and the ground simply is that colour.
  //
  // Painting light dots over the top instead tints the hero white on its way
  // out, which is the opposite of what a black section arriving should look
  // like — the matrix is how the ground turns black, not something added to it.
  // Coverage grows with the square of the radius, so a wipe that only reaches
  // half its radius has covered a quarter of the ground. Starting early and
  // ending before the travel does is what makes it read as a steady handover
  // rather than as nothing, then suddenly everything.
  float wipe = smoothstep(0.15, 0.9, uProgress);
  color = mix(color, uGroundEnd, dotMatrixWipe(px, wipe, uDotPx));

  gl_FragColor = vec4(color, 1.0);

  #include <colorspace_fragment>
}
`
