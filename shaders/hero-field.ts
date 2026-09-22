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
 * It draws neither the grid nor the light. The grid is one CSS layer over the
 * whole site (see StageDressing), and a second copy here would double every
 * line inside the hero. The light is gone from the site entirely: a near-white
 * wash at low alpha lifts every channel equally, which desaturates a blue
 * rather than brightening it, and it was the film flattening the ground.
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

uniform vec3 uGroundEnd;   // what the section below is painted in
// The page's own wash, stop for stop — see the tokens in globals.
uniform vec3 uWashLight;
uniform vec3 uWashLight2;
uniform vec3 uWashCore;
uniform vec3 uWashMid;
uniform vec3 uWashEdge;
uniform vec2 uResolution;   // framebuffer pixels
uniform float uDotPx;       // dot-matrix pitch for the handover
uniform float uProgress;    // hero scroll progress, 0..1
uniform vec2 uWipeBias;     // how much earlier the wipe reaches the top vs the bottom
uniform float uTopFade;     // share of the plane's height held fully handed over
uniform float uPixelRatio;  // device pixels per CSS pixel

varying vec2 vUv;

${dissolveChunk}

/**
 * The page ground, in viewport UV.
 *
 * A line-for-line port of --bg-wash: three radials composited source-over, so
 * the plane and the CSS layer behind it paint the same picture at the same
 * place. Both are anchored to the viewport, which is what lets them agree —
 * the plane moves with its section, but what it *paints* is a function of
 * where the fragment is on screen, not of where the plane is.
 *
 * It used to paint one flat colour, and that flat colour is why the closing
 * screen looked like a different blue from the band below it: the band was
 * the wash, and the section was a single value laid over the top of it.
 *
 * A CSS radial-gradient's stop positions are fractions of the gradient ray, so
 * a stop at 62% is at 0.62 of the normalised radius. Dividing by the ellipse's
 * own radii first is what turns the distance into that normalised measure.
 */
vec3 pageWash(vec2 uv) {
  float t = length((uv - vec2(0.5, 0.42)) / vec2(1.5, 1.1));
  vec3 base = t < 0.58
    ? mix(uWashCore, uWashMid, t / 0.58)
    : mix(uWashMid, uWashEdge, clamp((t - 0.58) / 0.42, 0.0, 1.0));

  float lit = 1.0 - clamp(length((uv - vec2(0.14, -0.02)) / vec2(0.86, 0.62)) / 0.62, 0.0, 1.0);
  base = mix(base, uWashLight, lit);

  float lit2 = 1.0 - clamp(length((uv - vec2(0.88, 0.98)) / vec2(0.70, 0.58)) / 0.58, 0.0, 1.0);
  return mix(base, uWashLight2, lit2);
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

  vec3 color = pageWash(screenUv);

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
  // Held back from 0.22. The dot matrix is the handover to the next section,
  // and starting it in the first fifth of the hero's travel puts it on screen
  // while the hero is still plainly the hero — it reads as the background
  // breaking up under something that has not begun to leave.
  float wipe = smoothstep(0.46, 1.0, uProgress);

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
