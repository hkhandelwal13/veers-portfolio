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

void main() {
  vec2 flow = (texture2D(uFlowTexture, vUv).rg * 2.0 - 1.0) * FLOW_RANGE;
  vec2 offset = flow * uDistortionStrength;

  // Clamped, so a large offset near the border samples the edge rather than
  // wrapping to the far side of the frame.
  vec2 distorted = clamp(vUv + offset, 0.0, 1.0);

  float aberration = uChromaticAberration;
  vec2 spread = flow * aberration;

  vec4 base = texture2D(uSceneTexture, distorted);
  float red = texture2D(uSceneTexture, clamp(distorted + spread, 0.0, 1.0)).r;
  float blue = texture2D(uSceneTexture, clamp(distorted - spread, 0.0, 1.0)).b;

  // Alpha comes from the undisplaced-channel sample. The canvas is transparent
  // and the page's own background shows through it, so the alpha has to travel
  // with the colour or the distorted edges cut holes in the page.
  gl_FragColor = vec4(red, base.g, blue, base.a);

  #include <colorspace_fragment>
}
`
