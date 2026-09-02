/**
 * The compositor — the captured frame, pushed around by the flowmap.
 *
 * The scene has already been rendered into uSceneTexture at the canvas's own
 * resolution and in its final colour space, so this pass writes what it samples
 * without converting anything. At zero strength it is therefore an exact copy,
 * which is what lets the whole pass be skipped outside the three sections that
 * use it without the picture changing at the boundary.
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

const float FLOW_RANGE = 4.0;

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
}
`
