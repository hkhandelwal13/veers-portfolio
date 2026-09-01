import { warpChunk } from './warp'

/**
 * The finale's arrow, as a window.
 *
 * At rest it is a solid, glossy object — the small blue arrow the sequence
 * starts and ends on. As the portal opens, its surface stops being a surface:
 * the body colour gives way to the warp field sampled in screen space, and the
 * shading that made it look solid fades with it. By the time it is off the
 * frame edges there is nothing left of the object but its silhouette, and the
 * silhouette is the whole screen.
 *
 * The rim belongs to the small arrow at either end and goes with the body. It
 * is an edge light, and once the camera is inside the mesh there is no edge —
 * see the note in the fragment.
 */

export const portalArrowVertexShader = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vViewDirection;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDirection = normalize(worldPosition.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

export const portalArrowFragmentShader = /* glsl */ `
precision highp float;

uniform vec2 uResolution;
uniform float uAspect;
uniform float uPortal;     // 0 = solid object, 1 = window
uniform float uSolid;      // 1 only while it is still small enough to be an object
uniform vec3 uBody;        // the arrow's own colour
uniform vec3 uRimColor;
uniform float uOpacity;

varying vec3 vWorldNormal;
varying vec3 vViewDirection;

${warpChunk}

void main() {
  vec2 screenUv = gl_FragCoord.xy / uResolution;
  vec3 normal = normalize(vWorldNormal);
  vec3 viewDir = normalize(vViewDirection);

  // abs, not clamp. Once the arrow is larger than the frustum the camera is
  // inside it and every visible face is a back face, so a clamped dot goes to
  // zero, the Fresnel goes to one, and the rim term paints a flat grey veil
  // over the entire screen at exactly the moment the warp should be clearest.
  float facing = abs(dot(normal, -viewDir));
  float fresnel = pow(1.0 - facing, 2.4);

  // The solid look: a lit body with a tight highlight.
  vec3 lightDir = normalize(vec3(0.35, 0.8, 0.6));
  float lambert = 0.45 + 0.55 * clamp(dot(normal, lightDir), 0.0, 1.0);
  vec3 halfway = normalize(lightDir - viewDir);
  float specular = pow(clamp(dot(normal, halfway), 0.0, 1.0), 52.0);
  vec3 solid = uBody * lambert + vec3(specular) * 0.9;

  // The window: the field behind, in screen space so the source stays put
  // while the arrow turns across it.
  vec3 field = warpField(screenUv, uAspect);

  // The body is gated on the arrow still being small, not on the portal.
  //
  // The portal opens over the whole zoom and closes over the whole collapse,
  // but the arrow is larger than the viewport for most of both — and a lit
  // surface stretched across the entire screen is not an object, it is a
  // coloured veil over the warp. So the solid look is only mixed in while
  // there is an object left to light.
  vec3 color = mix(field, solid, uSolid);

  // The rim fades *out* as the portal opens, not up.
  //
  // A Fresnel term traces a silhouette, and once the camera is inside the mesh
  // there is no silhouette left to trace — every visible face is oblique, the
  // term saturates, and what was an edge light becomes a flat wash over the
  // whole screen. It belongs to the small arrow at either end of the sequence.
  color += uRimColor * fresnel * uSolid * 0.3;

  gl_FragColor = vec4(color, uOpacity);

  #include <colorspace_fragment>
}
`
