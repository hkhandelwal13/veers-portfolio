/**
 * The compositor — the captured frame, pushed around by the flowmap.
 *
 * The capture is sRGB-encoded, which on WebGL2 means the target's texture is a
 * true sRGB internal format and the hardware decodes it to linear on every
 * sample. So the values arriving here are linear and have to be re-encoded on
 * the way out — the colorspace_fragment chunk at the end is that, and without
 * it every pixel on the page is written a full sRGB decode too dark. The round
 * trip is otherwise exact, which is what lets the pass be skipped outside the
 * three sections that use it without the picture changing at the boundary.
 *
 * Encoding the capture rather than storing it linear is deliberate: this site
 * is mostly near-black grounds, and eight bits of linear light bands visibly in
 * exactly those.
 *
 * Chromatic aberration is along the flow direction rather than radial: the
 * separation belongs to the movement, so it should appear where the fluid is
 * moving and nowhere else. Radial separation is a lens artefact and would sit
 * on the frame permanently.
 */

export const fluidDistortionFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uSceneTexture;
uniform sampler2D uFlowTexture;
uniform float uDistortionStrength;
uniform float uChromaticAberration;

varying vec2 vUv;

const float FLOW_RANGE = 8.0;
const int DISPERSION_TAPS = 5;

void main() {
  vec2 flow = (texture2D(uFlowTexture, vUv).rg * 2.0 - 1.0) * FLOW_RANGE;
  vec2 offset = flow * uDistortionStrength;

  // Clamped, so a large offset near the border samples the edge rather than
  // wrapping to the far side of the frame.
  vec2 distorted = clamp(vUv + offset, 0.0, 1.0);

  vec2 spread = flow * uChromaticAberration;

  // Spectral, not three-channel.
  //
  // Sampling R, G and B at three offsets gives coloured edges; the reference
  // has a continuous rainbow through the smear, which is what you get by
  // walking the offset and weighting each step toward one end of the spectrum.
  // Every tap coincides where the flow is zero, so this is still an exact copy
  // of the frame at rest.
  vec3 colour = vec3(0.0);
  vec3 weights = vec3(0.0);

  for (int i = 0; i < DISPERSION_TAPS; i++) {
    float t = float(i) / float(DISPERSION_TAPS - 1);
    vec2 tapUv = clamp(distorted + spread * (t * 2.0 - 1.0), 0.0, 1.0);
    vec3 weight = vec3(
      smoothstep(0.45, 1.0, t),
      1.0 - abs(t - 0.5) * 1.7,
      smoothstep(0.55, 0.0, t)
    );
    weight = max(weight, 0.0);
    colour += texture2D(uSceneTexture, tapUv).rgb * weight;
    weights += weight;
  }

  colour /= max(weights, vec3(1e-4));

  // Alpha from the undisplaced-channel sample: the canvas is transparent and
  // the page's own background shows through it, so the alpha has to travel with
  // the colour or the distorted edges cut holes in the page.
  gl_FragColor = vec4(colour, texture2D(uSceneTexture, distorted).a);

  #include <colorspace_fragment>
}
`
