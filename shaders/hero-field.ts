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
 * It draws the diagonal light, not the grid: the grid is one CSS layer drawn
 * over the whole site (see StageDressing), and a second copy here would double
 * every line inside the hero.
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
uniform vec4 uStreakGlow;
uniform vec4 uStreakBand;

uniform vec2 uResolution;   // framebuffer pixels
uniform float uDotPx;       // dot-matrix pitch for the handover
uniform float uTime;
uniform float uProgress;    // hero scroll progress, 0..1
uniform vec2 uWipeBias;     // how much earlier the wipe reaches the top vs the bottom
uniform float uTopFade;     // share of the plane's height held fully handed over
uniform float uPixelRatio;  // device pixels per CSS pixel
uniform float uAspect;

varying vec2 vUv;

${dissolveChunk}

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
  float dressing = 1.0 - smoothstep(0.1, 0.5, uProgress);

  float glow = exp(-length((screenUv - vec2(0.16, -0.06)) * vec2(uAspect, 1.0)) * 2.1);
  color += uStreakGlow.rgb * uStreakGlow.a * glow * dressing;
  color += uStreakBand.rgb * uStreakBand.a * streakMask(screenUv) * 0.5 * dressing;
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
  float wipe = smoothstep(0.22, 1.0, uProgress);

  // Biased down the stage: the far end finishes first, so the black rises from
  // below and deepens as you travel into it. Because the plane spans both
  // sections, this also means the coverage you see at any moment is a function
  // of where you are in the scroll — which is the whole illusion. There is no
  // second background arriving; the ground you are already looking at is
  // turning black underneath you.
  // The handover runs bottom-to-top on the hero's ground, which is one plane
  // spanning several sections. A section-sized plane wants it flat instead: a
  // gradient across 140vh puts a visible horizontal edge wherever it meets the
  // plane above, because the two disagree about how far along they are at the
  // pixel they share.
  float bias = mix(uWipeBias.x, uWipeBias.y, vUv.y);

  // Hold the top edge fully handed over. A plane that covers one section shows
  // its own boundary against whatever is above it the moment it starts to
  // un-dissolve — the dots stop at a horizontal line. Pushing the bias up over
  // the top band keeps that band clamped at "handed over" until the edge is off
  // the screen, so the ground arrives as a soft gradient instead of an edge.
  bias += 6.0 * smoothstep(1.0 - uTopFade, 1.0, vUv.y);
  color = mix(color, uGroundEnd, dotMatrixWipe(px, clamp(wipe * bias, 0.0, 1.0), uDotPx));

  gl_FragColor = vec4(color, 1.0);

  #include <colorspace_fragment>
}
`
