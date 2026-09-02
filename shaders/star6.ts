/**
 * Star-6 lens flare (PHASE4_KICKOFF item 6).
 *
 * Six rays from three axes, the pattern a six-point star filter puts on stage
 * and music-video footage. The point is to make the glass read as something
 * filmed rather than cleanly rendered.
 *
 * The source is a render of the glass alone, so the streaks key off its
 * specular highlights and never off the bright poster cards — thresholding the
 * finished frame instead would put rays on every light thing on the page.
 *
 * Cost is managed by where this runs, not by what it does: half resolution,
 * every other frame, and skipped entirely while the glass is offscreen.
 */

// Shared with the fluid passes; see shaders/fullscreen.
export { fullscreenVertexShader } from './fullscreen'

export const star6FragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uSource;
uniform vec2 uTexel;       // 1 / source resolution
uniform float uThreshold;
uniform float uStreakScale;
uniform float uIntensity;

varying vec2 vUv;

float luma(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

/** Keeps only what is brighter than the threshold, renormalised to 0..1. */
float brightMask(float luminance) {
  float value = max(luminance - uThreshold, 0.0) / max(1.0 - uThreshold, 1e-5);
  return smoothstep(0.0, 1.0, clamp(value, 0.0, 1.0));
}

vec3 sampleBright(vec2 uv) {
  vec3 color = texture2D(uSource, clamp(uv, 0.0, 1.0)).rgb;
  return color * brightMask(luma(color));
}

/** Walks out along one axis in both directions, weight falling with distance. */
vec3 streak(vec2 direction) {
  vec3 total = vec3(0.0);
  for (int i = 1; i <= 8; i++) {
    float distance = float(i) * 1.5;
    float weight = 1.0 / (1.0 + distance * 0.22);
    weight *= weight;

    vec2 offset = direction * distance;
    total += sampleBright(vUv + offset) * weight;
    total += sampleBright(vUv - offset) * weight;
  }
  return total;
}

void main() {
  vec3 base = texture2D(uSource, vUv).rgb;
  vec3 flare = base * brightMask(luma(base)) * 1.2;

  vec2 px = uTexel * uStreakScale;

  // Three axes at 60 degrees to each other give the six rays: one vertical,
  // two at +/-30 degrees from horizontal.
  flare += streak(vec2(0.0, px.y));
  flare += streak(vec2(px.x * 0.8660254, px.y * 0.5));
  flare += streak(vec2(px.x * 0.8660254, -px.y * 0.5));

  gl_FragColor = vec4(flare * uIntensity, 1.0);
}
`

/** Composites the star buffer over the finished frame, additively. */
export const starCompositeFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uStar;
uniform float uOpacity;

varying vec2 vUv;

void main() {
  vec3 star = texture2D(uStar, vUv).rgb;
  float strength = max(max(star.r, star.g), star.b);
  if (strength <= 0.002) discard;
  gl_FragColor = vec4(star * uOpacity, 1.0);
}
`
