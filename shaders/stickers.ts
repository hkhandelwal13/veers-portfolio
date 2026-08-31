/**
 * Instanced sticker atlas shader.
 *
 * Every sticker is one instance of the same unit quad, drawn in a single call.
 * The per-instance `aUvRect` says which corner of the packed atlas that
 * instance should show, so seventeen different images cost one draw and one
 * texture bind instead of seventeen of each — which matters here because the
 * refraction pass renders them a second time every frame.
 *
 * They share the hero's two screen-space rules with the backdrop and the glass:
 * the pointer's wake moves them, and the scroll dissolve breaks them into dots.
 */

import { dissolveChunk, rippleChunk } from './fluid'

export const stickerVertexShader = /* glsl */ `
attribute vec4 aUvRect;   // xy = atlas origin, zw = size
attribute float aOpacity;

uniform vec2 uRippleWorld;  // world units per UV, for converting the wake

varying vec2 vAtlasUv;
varying float vOpacity;

${rippleChunk}

void main() {
  // The quad's own 0..1 uv is remapped into this instance's slice of the atlas.
  vAtlasUv = aUvRect.xy + uv * aUvRect.zw;
  vOpacity = aOpacity;

  vec4 world = instanceMatrix * vec4(position, 1.0);

  // The wake is defined in screen UV, so each instance is placed into that
  // space by its own centre — displacing per vertex instead would shear the
  // sticker rather than move it.
  vec4 centre = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec4 centreClip = projectionMatrix * modelViewMatrix * centre;
  vec2 centreUv = centreClip.xy / max(centreClip.w, 1e-4) * 0.5 + 0.5;
  centreUv.y = 1.0 - centreUv.y;   // screen UV runs down, clip space runs up

  vec2 offset = rippleOffset(centreUv);
  world.xy += vec2(offset.x, -offset.y) * uRippleWorld;

  gl_Position = projectionMatrix * modelViewMatrix * world;
}
`

export const stickerFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uAtlas;
uniform float uFade;      // hero exit: overall opacity
uniform float uDissolve;  // hero exit: dot-matrix progress
uniform float uDotPx;

varying vec2 vAtlasUv;
varying float vOpacity;

${dissolveChunk}

void main() {
  vec4 color = texture2D(uAtlas, vAtlasUv);
  color.a *= vOpacity * uFade;

  // Same rule as the background and the glass, so the three come apart as one
  // event rather than three separate fades.
  color.a *= dotMatrixMask(gl_FragCoord.xy, uDissolve, uDotPx);

  if (color.a <= 0.01) discard;

  gl_FragColor = color;

  #include <colorspace_fragment>
}
`
