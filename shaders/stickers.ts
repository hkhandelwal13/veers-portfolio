/**
 * Instanced sticker atlas shader.
 *
 * Every sticker is one instance of the same unit quad, drawn in a single call.
 * The per-instance `aUvRect` says which corner of the packed atlas that
 * instance should show, so seventeen different images cost one draw and one
 * texture bind instead of seventeen of each — which matters here because the
 * refraction pass renders them a second time every frame.
 */

export const stickerVertexShader = /* glsl */ `
attribute vec4 aUvRect;   // xy = atlas origin, zw = size
attribute float aOpacity;

varying vec2 vAtlasUv;
varying float vOpacity;

void main() {
  // The quad's own 0..1 uv is remapped into this instance's slice of the atlas.
  vAtlasUv = aUvRect.xy + uv * aUvRect.zw;
  vOpacity = aOpacity;

  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`

export const stickerFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uAtlas;

varying vec2 vAtlasUv;
varying float vOpacity;

void main() {
  vec4 color = texture2D(uAtlas, vAtlasUv);
  color.a *= vOpacity;

  if (color.a <= 0.01) discard;

  gl_FragColor = color;

  #include <colorspace_fragment>
}
`
