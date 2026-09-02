/**
 * The vertex shader every fullscreen pass on this site shares.
 *
 * The plane is 2x2 in local space, so its position IS clip space and its uv
 * runs 0..1 across the target. The camera is bypassed deliberately: these
 * quads must cover their target exactly, whatever any camera is doing.
 */
export const fullscreenVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`
