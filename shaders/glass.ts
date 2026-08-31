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
uniform vec2 uLocalYRange;   // geometry-space min/max Y, for the tint gradient

varying vec3 vWorldNormal;
varying vec3 vViewDirection;
varying float vGradient;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDirection = normalize(worldPosition.xyz - cameraPosition);

  // 0 at the bottom of the word, 1 at the top — drives the two-tint blend, so
  // the glass shifts in hue down its height instead of being one flat colour.
  vGradient = clamp(
    (position.y - uLocalYRange.x) / max(uLocalYRange.y - uLocalYRange.x, 1e-5),
    0.0,
    1.0
  );

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
uniform vec3 uTintSecondary;   // blended in along the word's height
uniform float uTintAmount;
uniform float uDark;           // 0 = light theme, 1 = dark

uniform float uDarkGlow;       // dark theme: internal glow per unit thickness
uniform float uDarkEdge;        // dark theme: multiplier on the Fresnel edge

uniform float uHighlightOnly;  // 1 = output just the specular, for the flare pass
uniform vec3 uRimColor;
uniform float uRimPower;
uniform float uRimStrength;
uniform vec3 uLightDirection;  // ring-constrained, driven by the PointerBus

varying vec3 vWorldNormal;
varying vec3 vViewDirection;
varying float vGradient;

vec3 applyTint(vec3 color, float thickness) {
  float dark = clamp(uDark, 0.0, 1.0);

  // The two ends of the height gradient swap with the theme, so the word keeps
  // a hue shift down its body either way. Light runs pale-over-deep; dark runs
  // deep-over-pale, which is the direction that keeps the top edge legible
  // against the page rather than dissolving into it.
  vec3 body = mix(uTintLight, uTintDark, dark);
  vec3 secondary = mix(uTintSecondary, uTintLight, dark);
  vec3 tint = clamp(mix(secondary, body, vGradient), 0.001, 1.0);
  float amount = clamp(uTintAmount, 0.0, 1.0);

  // Light: what survives transmission through the body, Beer-Lambert style.
  // Thickness varies per fragment, so edges absorb more than flat faces —
  // without that the glass is one even wash and reads as paint, not glass.
  vec3 transmitted = pow(tint, vec3(max(thickness, 0.01)));
  vec3 beer = mix(color, color * transmitted, amount);

  // Dark: absorption has nothing left to remove — the scene behind the glass is
  // the near-black page — so it is replaced rather than inverted.
  //
  // Note this is NOT a Hard Light blend. Hard Light with a fixed tint as the
  // blend layer collapses to very nearly a constant: every channel below 0.5
  // multiplies an already-black scene to zero, and the survivors are whatever
  // the tint happens to be. The word comes out as one flat slab of blue with
  // the refraction, the dispersion and the stickers behind it all erased —
  // paint, not glass. So: tint the little light that is there, then add an
  // internal glow that grows with thickness. The scene's structure survives
  // multiplication, and the depth cue comes from the body rather than from a
  // blend mode.
  vec3 tinted = color * mix(vec3(1.0), tint * 2.0, amount);
  vec3 lifted = tinted + tint * uDarkGlow * clamp(thickness, 0.0, 2.0);

  return mix(beer, lifted, dark);
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

  // How square-on we are looking at this fragment. Face-on sees the least
  // material; a grazing angle looks along the body and sees much more, which is
  // the approximation of thickness the tint uses.
  float facingView = clamp(dot(normal, -viewDir), 0.0, 1.0);
  float thickness = uThickness * (0.35 + 1.9 * (1.0 - facingView));

  color = applyTint(color, thickness);

  // Fresnel — grazing angles reflect more, which is what reads as "glass".
  float fresnel = pow(1.0 - facingView, uRimPower);

  // Rim light. Constrained to the silhouette by the Fresnel term, so the
  // highlight rides the letter edges instead of flooding the front face even
  // when the pointer is near the middle of the screen.
  float facing = clamp(dot(normal, normalize(uLightDirection)), 0.0, 1.0);
  float rim = fresnel * pow(facing, 2.0) * uRimStrength;

  // On dark there is no transmitted colour to describe the letterforms, so the
  // edges have to do it. Same specular, turned up.
  float dark = clamp(uDark, 0.0, 1.0);
  rim *= mix(1.0, uDarkEdge, dark);

  vec3 highlight = uRimColor * rim;

  color += highlight;
  // A little plain Fresnel keeps the whole edge alive, not just the lit side.
  // This one only follows uDarkEdge part of the way: it is warm white and it
  // covers the whole silhouette, so turning it up as far as the directional rim
  // washes the blue straight out of the body and the glass goes grey.
  color += uRimColor * fresnel * 0.06 * mix(1.0, 1.0 + (uDarkEdge - 1.0) * 0.3, dark);

  // The lens flare renders the glass a second time with this set, and keys off
  // the result. It has to be the specular alone: on a light page the glass body
  // is bright by nature — it is refracting white paper — so a luminance
  // threshold over the finished material flags the entire word as a highlight
  // and blooms over the whole hero. Only the specular is actually a highlight.
  gl_FragColor = mix(vec4(color, 1.0), vec4(highlight, 1.0), clamp(uHighlightOnly, 0.0, 1.0));

  #include <colorspace_fragment>
}
`
