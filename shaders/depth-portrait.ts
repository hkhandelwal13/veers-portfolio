/**
 * 2.5D portrait — a photograph given parallax by an offline depth map.
 *
 * Not a displaced mesh. The plane stays flat and the *sampling* moves: each
 * fragment reads the colour a little further along the view direction the
 * deeper it is, which is parallax occlusion mapping in its simplest form. A
 * displaced grid would need the geometry to be dense enough to hold an edge,
 * and would tear at the silhouette where depth jumps; shifting UVs costs one
 * texture read and cannot tear.
 *
 * The depth map is authored offline (public/face-depth.png): white is near,
 * black is far, which is the convention every depth-estimation tool emits.
 */

export const depthPortraitVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const depthPortraitFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform vec2 uParallax;   // pointer offset, already eased and scaled
uniform float uStrength;
uniform float uFade;

varying vec2 vUv;

/** Marches along the view offset and stops at the first surface it crosses. */
vec2 parallaxUv(vec2 uv, vec2 offset) {
  const int STEPS = 12;

  vec2 step = offset / float(STEPS);
  float layer = 1.0;
  float layerStep = 1.0 / float(STEPS);

  vec2 current = uv;
  float sampled = texture2D(uDepth, current).r;

  for (int i = 0; i < STEPS; i++) {
    if (sampled >= layer) break;
    current += step;
    layer -= layerStep;
    sampled = texture2D(uDepth, current).r;
  }

  return current;
}

void main() {
  vec2 offset = uParallax * uStrength;
  vec2 uv = parallaxUv(vUv, offset);

  // Anything the march walked off the plane would repeat the edge pixel across
  // the frame, so it is cut instead.
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;

  vec4 color = texture2D(uColor, uv);
  gl_FragColor = vec4(color.rgb, color.a * uFade);

  #include <colorspace_fragment>
}
`
