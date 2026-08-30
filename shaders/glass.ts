/**
 * Glass material for the `hello` word (PHASE4_KICKOFF item 4).
 *
 * Screen-space refraction: a pass earlier in the frame rendered everything
 * except the glass into `uSceneTexture`, and this shader samples that image
 * along directions bent by the surface normal. Because the source is a picture
 * of the scene rather than the scene itself, the cost is one extra scene render
 * per frame regardless of how complex the glass geometry is.
 *
 * Built on the approach in Maxime Heckel's "Refraction, dispersion, and other
 * shader light effects" — refraction, per-channel dispersion, and a Fresnel
 * term — with our own tint, theme handling and rim light on top.
 *
 * Tint follows BRAND_TOKENS: Sky Blue body, Ocean Blue for the dark variant.
 * Light and dark are blended differently on purpose (see applyTint).
 */

export const glassVertexShader = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vViewDirection;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDirection = normalize(worldPosition.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

export const glassFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uSceneTexture;
uniform vec2 uResolution;      // framebuffer pixels

uniform float uIor;            // base index of refraction
uniform float uDispersion;     // spread between the R and B indices
uniform float uRefractStrength;// how far the sampled UV is pushed, in screen space
uniform float uThickness;      // feeds the Beer-Lambert falloff

uniform vec3 uTintLight;       // Sky Blue  — light theme body
uniform vec3 uTintDark;        // Ocean Blue — dark theme body
uniform float uTintAmount;
uniform float uDark;           // 0 = light theme, 1 = dark

uniform vec3 uRimColor;
uniform float uRimPower;
uniform float uRimStrength;
uniform vec3 uLightDirection;  // ring-constrained, driven by the PointerBus

varying vec3 vWorldNormal;
varying vec3 vViewDirection;

/**
 * Hard Light, used for the dark theme's tint.
 *
 * Beer-Lambert absorption is the physically-motivated choice and looks right on
 * a light ground, but on a dark one it only ever subtracts from an already dark
 * image and the glass goes muddy. Hard Light lifts the colour instead, which is
 * an art-direction decision rather than a second physical model.
 */
vec3 hardLight(vec3 base, vec3 blend) {
  vec3 low = 2.0 * base * blend;
  vec3 high = 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
  return mix(low, high, step(vec3(0.5), blend));
}

vec3 applyTint(vec3 color) {
  vec3 tint = clamp(mix(uTintLight, uTintDark, clamp(uDark, 0.0, 1.0)), 0.001, 1.0);
  float amount = clamp(uTintAmount, 0.0, 1.0);

  // Light: what survives transmission through the body, Beer-Lambert style.
  vec3 transmitted = pow(tint, vec3(max(uThickness, 0.01)));
  vec3 beer = mix(color, color * transmitted, amount);

  // Dark: lift rather than absorb.
  vec3 lifted = mix(color, hardLight(clamp(color, 0.0, 1.0), tint), amount);

  return mix(beer, lifted, clamp(uDark, 0.0, 1.0));
}

/** Samples the scene behind the glass along one refracted direction. */
vec3 sampleRefracted(vec2 screenUv, vec3 normal, vec3 viewDir, float ior) {
  vec3 refracted = refract(viewDir, normal, 1.0 / ior);
  vec2 offset = refracted.xy * uRefractStrength;
  return texture2D(uSceneTexture, clamp(screenUv + offset, 0.001, 0.999)).rgb;
}

void main() {
  vec2 screenUv = gl_FragCoord.xy / uResolution;
  vec3 normal = normalize(vWorldNormal);
  vec3 viewDir = normalize(vViewDirection);

  // Chromatic dispersion: the three channels bend by slightly different
  // amounts, which is what puts colour along the edges rather than a grey blur.
  vec3 color;
  color.r = sampleRefracted(screenUv, normal, viewDir, uIor - uDispersion).r;
  color.g = sampleRefracted(screenUv, normal, viewDir, uIor).g;
  color.b = sampleRefracted(screenUv, normal, viewDir, uIor + uDispersion).b;

  color = applyTint(color);

  // Fresnel — grazing angles reflect more, which is what reads as "glass".
  float fresnel = pow(1.0 - clamp(dot(normal, -viewDir), 0.0, 1.0), uRimPower);

  // Rim light. Constrained to the silhouette by the Fresnel term, so the
  // highlight rides the letter edges instead of flooding the front face even
  // when the pointer is near the middle of the screen.
  float facing = clamp(dot(normal, normalize(uLightDirection)), 0.0, 1.0);
  float rim = fresnel * pow(facing, 2.0) * uRimStrength;

  color += uRimColor * rim;
  // A little plain Fresnel keeps the whole edge alive, not just the lit side.
  color += uRimColor * fresnel * 0.06;

  gl_FragColor = vec4(color, 1.0);

  #include <colorspace_fragment>
}
`
