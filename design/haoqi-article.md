# Inside HAOQI.DESIGN: Letting DOM and WebGL Share a Retro-Futurist Stage

> Reference for Phase 3+ (see PHASE3_KICKOFF.md). Saved here because the live
> article is not fetchable by bots.
>
> **This is reference, not source.** Per the Phase 3 kickoff, our systems are
> implemented fresh from the described method and the public sources credited
> below (Lenis host-raf; JOYCO WebGL Scroll Sync). We do not copy this code
> verbatim, and we use our own assets.

A technical look at the making of HAOQI.DESIGN, exploring scroll sync, glass
shaders, and the interplay of DOM, CSS, and WebGL in a retro-futurist
portfolio. — Haoqi Wen, Codrops, 2026-08-15.

---

## Technical overview

Next.js + React · Lenis · Motion · Three.js / React Three Fiber / Drei ·
custom shaders and post-processing · Spline for 3D models · Figma for stickers.

---

## 1. Keeping DOM and WebGL on the same frame

### One scroll source for DOM and WebGL

The site scrolls vertically. DOM handles text and typography; a fixed canvas
carries the glass model and image effects. Scrolling moves the DOM, so every
object in the canvas has to follow the same position.

In the first version, Lenis updated the DOM while R3F read `window.scrollY`
inside `useFrame`. It looked fine at low speeds, but fast scrolling revealed a
consistent one-frame delay in WebGL: Lenis and R3F each owned a
`requestAnimationFrame` loop. If R3F ran first it read the previous scroll
value, and Lenis only advanced afterwards. A custom scroll container made this
worse, because `window.scrollY` was not necessarily the value Lenis maintained.
No amount of interpolation tuning fixes a problem caused by execution order and
an unreliable data source.

After looking at Lenis' manual raf approach and JOYCO's WebGL Scroll Sync,
scrolling and rendering moved into one frame loop. Lenis' own loop is disabled.
R3F calls `lenis.raf` through `addEffect`, then a ScrollBus records Lenis'
scroll value for that frame. Every later `useFrame` consumer reads the same
snapshot. DOM and WebGL agree on both the data and the moment it becomes
current.

```tsx
// scroll_root.tsx
function ScrollShell({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis options={{ /* ... */, autoRaf: false }}>
      <LenisScrollEnvBridge />
      {children}
    </ReactLenis>
  )
}

function LenisScrollEnvBridge() {
  const lenis = useLenis()

  useEffect(() => {
    bindLenisScrollBus(lenis ?? null)
    return () => bindLenisScrollBus(null)
  }, [lenis])

  useEffect(() => {
    if (!lenis) return
    return addEffect((time: number) => {
      lenis.raf(time)
    })
  }, [lenis])

  return null
}
```

Once `lenis.raf` advances the scroll, Lenis emits its scroll event and updates
the ScrollBus in the same frame. WebGL components that run afterwards read the
fresh snapshot directly.

```ts
// lenis_scroll_bus.ts
import type Lenis from "lenis"

// The production snapshot also includes limit, progress, velocity,
// direction, and viewportHeight.
type ScrollSnapshot = { scrollTop: number }

let snapshot: ScrollSnapshot = { scrollTop: 0 }
const listeners = new Set<() => void>()
let unbind: (() => void) | null = null

export const bindLenisScrollBus = (lenis: Lenis | null) => {
  unbind?.()
  unbind = null
  if (!lenis) return

  const onScroll = ({ scroll }: { scroll: number }) => {
    snapshot = { scrollTop: scroll }
    for (const listener of listeners) listener()
  }

  lenis.on("scroll", onScroll)
  unbind = () => lenis.off("scroll", onScroll)
  snapshot = { scrollTop: lenis.scroll }
}

export const getLenisScrollSnapshot = () => snapshot
export const subscribeLenisScroll = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
```

WebGL runs frame by frame and reads the latest value. React components that
need scroll state for DOM output subscribe through `useSyncExternalStore`. The
rest of the tree stays untouched.

```ts
// WebGL reads during useFrame without triggering React renders.
const scrollY = getLenisScrollSnapshot().scrollTop

// React subscribes only where the value affects DOM output.
const SERVER_SCROLL_SNAPSHOT = { scrollTop: 0 }
const scroll = useSyncExternalStore(
  subscribeLenisScroll,
  getLenisScrollSnapshot,
  () => SERVER_SCROLL_SNAPSHOT,
)
```

### One pointer coordinate system for every effect

When interaction stays inside a canvas, R3F's normalized `state.pointer` is
usually enough. Here the same pointer also drives DOM coordinate readouts,
camera parallax, the glass rim light, and a fluid effect. Letting each feature
listen for pointer input on its own meant repeating the same coordinate
conversion, Y-axis inversion, and leave-state handling.

Reusing the ScrollBus idea, a global PointerBus converts browser coordinates
into a 0-to-1 UV once, and keeps an `inside` flag. When the pointer leaves, the
page loses focus, or the tab becomes hidden, the UV returns to the center, so
effects settle instead of jumping from a stale coordinate.

A single write updates both a mutable `Vector2` for WebGL and an immutable
snapshot for React.

```ts
type PointerSnapshot = {
  x: number
  y: number
  inside: boolean
}

// One write keeps DOM and WebGL on the same x / y / inside state.
const updatePointer = (next: PointerSnapshot) => {
  snapshotRef.current = next      // React snapshot
  uv.set(next.x, next.y)          // WebGL
  insideRef.current = next.inside // WebGL
  scheduleNotify()                // React, at most once per frame
}
```

---

## 2. DOM for layout, WebGL for the unexpected

The project list needs to be readable and browsable first. DOM and CSS Grid own
structure, responsive behaviour, and accessibility. Transparent image
placeholders are measured and mirrored into the canvas, where WebGL handles
states that would be awkward in DOM.

### Mirroring a DOM grid in WebGL

Each project image keeps a transparent DOM placeholder with a ref. CSS Grid
decides position and dimensions. `Element.getBoundingClientRect()` gives the
rectangle, but not every card reads layout on every frame — one sampler
maintains a shared rectangle cache.

During a scroll the sampler first corrects cached rectangles by the scroll
delta. Cards near the viewport are measured every frame. Distant cards refresh
once every 12 frames, staggered across the list, which avoids bunching all DOM
reads into the same frame.

```ts
// Simplified DomTargetRectSampler.
useFrame(() => {
  const rects = targetRectMapRef.current
  const scrollTop = getScrollTop()
  const deltaY = scrollTop - lastScrollTop
  lastScrollTop = scrollTop

  // Scroll moves cached viewport rects without another layout read.
  for (const rect of Object.values(rects)) {
    rect.top -= deltaY
    rect.bottom -= deltaY
  }

  layers.forEach((layer, index) => {
    const previous = rects[layer.key]
    const nearViewport = !previous || isNearViewport(previous)
    const staggeredRefresh = frame % 12 === index % 12
    if (!nearViewport && !staggeredRefresh) return

    const element = layer.targetRef.current
    if (element) updateCachedRect(layer.key, element.getBoundingClientRect())
  })

  frame += 1
}, -3)
```

The sampler runs before the image components, so a nearby image reads a freshly
measured rectangle in the same frame. The cache lives in a ref map and never
causes a React render. A mesh hides and stops updating when its texture is not
ready, its rectangle is invalid, or the image is far outside the viewport. Its
reveal progress resets offscreen.

One fullscreen mesh per image keeps the coordinate math simple. Rather than
moving 3D geometry to match the DOM, the rectangle's position and size are
written into `uRect`. The shader turns screen UV into card-local coordinates.
Fullscreen meshes add overdraw, so only images near the viewport are rendered.

```glsl
// dom_sync.frag.glsl
uniform vec4 uRect; // xy origin, zw size
uniform sampler2D map;

vec4 sampleDomImage(vec2 screenUv) {
  vec2 localUv = (screenUv - uRect.xy) / uRect.zw;
  vec2 edge = min(localUv, 1.0 - localUv);
  float inside = step(0.0, edge.x) * step(0.0, edge.y);
  vec4 color = texture2D(map, clamp(localUv, 0.0, 1.0));
  color.a *= inside;
  return color;
}
```

Writing `uRect` requires one coordinate-system correction: screen coordinates
begin at the top left, shader UV at the bottom left, so **Y has to be flipped**.
After that, CSS is free to change columns, gaps, and card ratios; WebGL only
follows the resulting rectangles.

### The unexpected starts on hover

Every card has two images. Instead of a crossfade, the shader divides the screen
into a fixed grid. The reveal spreads from the centre of the card while a square
grows inside each cell, uncovering the second image. This dot-matrix language
later reappears in loading, page transitions, and the mobile menu.

```glsl
// Inputs shared by both images.
uniform sampler2D map;
uniform sampler2D mapHover;
uniform vec4 uRect;
uniform float uHoverRevealProgress;
uniform float uDotPixelSize;
uniform vec2 uViewportPx;

vec4 revealHoverImage(vec2 screenUv) {
  // 1. Map the full-screen UV into the DOM card.
  vec2 localUv = (screenUv - uRect.xy) / uRect.zw;
  float rectWidthPx = max(uRect.z * uViewportPx.x, 1.0);
  float rectHeightPx = max(uRect.w * uViewportPx.y, 1.0);

  // 2. Divide screen space into fixed-size cells.
  vec2 viewportPx = max(uViewportPx, vec2(1.0));
  vec2 cellSizeUv = vec2(max(2.0, uDotPixelSize)) / viewportPx;
  vec2 cellUv = fract(screenUv / cellSizeUv);
  float squareDist = max(abs(cellUv.x - 0.5), abs(cellUv.y - 0.5));

  // 3. Expand from the card center and grow a square in each cell.
  float rectAspect = rectWidthPx / rectHeightPx;
  vec2 centered = localUv * 2.0 - 1.0;
  centered.x *= rectAspect;
  float distToCenter = length(centered);
  float maxRadius = length(vec2(rectAspect, 1.0));
  float progress = clamp(uHoverRevealProgress, 0.0, 1.0);
  float radius = progress * (maxRadius + 0.12);
  float grow = 1.0 - smoothstep(radius - 0.12, radius + 0.12, distToCenter);
  grow *= step(0.0001, progress);

  float squareExtent = mix(0.0, 0.5, grow);
  float squareAa = max(fwidth(squareDist), 0.0001);
  float squareMask = 1.0 - smoothstep(
    squareExtent - squareAa,
    squareExtent + squareAa,
    squareDist
  );

  // Mix the aligned textures with the generated mask.
  vec4 baseColor = texture2D(map, clamp(localUv, 0.0, 1.0));
  vec4 hoverColor = texture2D(mapHover, clamp(localUv, 0.0, 1.0));
  vec4 color = mix(baseColor, hoverColor, squareMask);
  vec2 edge = min(localUv, 1.0 - localUv);
  color.a *= step(0.0, edge.x) * step(0.0, edge.y);

  return color;
}
```

### Developing the image as it enters the frame

Once a card enters the viewport its image develops from a negative over 0.8s.
Progress returns to zero when the card leaves completely. With
`prefers-reduced-motion`, the transition is skipped.

```glsl
uniform float uPolarityPositive; // 0 = negative, 1 = original

// Blend from the negative image back to its original color.
vec3 applyPolarity(vec3 rgb) {
  float t = clamp(uPolarityPositive, 0.0, 1.0);
  return mix(1.0 - rgb, rgb, t);
}
```

### Making scroll speed visible with a shader

Distance travelled between two frames, divided by time, gives velocity,
normalized into `uCurlStrength` so images flex along the horizontal axis in
response to speed rather than accumulating distortion with distance. Two time
constants — fast attack, slower release — keep trackpad fluctuations from
becoming visual noise, and `delta` is clamped so a backgrounded page waking up
cannot produce an extreme value.

```ts
// dom_sync_img.tsx
function createCurlStrengthSampler() {
  let previousScrollY: number | null = null
  let activity = 0

  return (scrollY: number, delta: number) => {
    const dt = THREE.MathUtils.clamp(delta, 1 / 240, 0.1)
    const velocity = previousScrollY == null
      ? 0
      : Math.abs(scrollY - previousScrollY) / dt
    previousScrollY = scrollY

    // Normalize scroll speed into the target curl activity.
    const target = THREE.MathUtils.clamp(velocity / 800, 0, 1)

    // Fast attack and slow release smooth small trackpad fluctuations.
    const tau = target > activity ? 0.025 : 0.175
    const alpha = 1 - Math.exp(-dt / tau)
    activity += (target - activity) * alpha

    // Map the smoothed activity to the maximum curl strength.
    return 0.06 * activity
  }
}
```

```glsl
// dom_sync.frag.glsl
uniform float uCurlStrength;

vec2 applyCurl(vec2 screenUv) {
  float centered = 2.0 * screenUv.y - 1.0;
  float profile = 1.0 - sqrt(max(0.0, 1.0 - centered * centered));

  // Higher speed increases uCurlStrength and compresses X near the top and bottom.
  float uvScale = 1.0 - profile * uCurlStrength;
  float distortedX = (screenUv.x - 0.5) * uvScale + 0.5;
  return vec2(distortedX, screenUv.y);
}
```

---

## 3. Turning hello into a glass centerpiece

The text was built in Spline, exported as GLTF, keeping only the geometry.
Three.js handles lighting and material. The glass shader builds on Maxime
Heckel's "Refraction, dispersion, and other shader light effects", adding
interaction, theme-aware tinting, and more control over rendering cost.

Refraction happens in two passes. The glass is excluded from an FBO while the
scene behind it renders into a texture; the main scene then draws the glass,
sampling that texture along slightly different refraction directions for
distortion and dispersion. The glass uses its own Three.js layer so the FBO
never captures the object itself.

### Letting the highlight follow the pointer without leaving the rim

A rim light that followed the pointer directly drifted onto the face of the
glass near screen centre. Keeping the pointer's *direction* but discarding its
distance fixes it: pointer UV is raycast onto a plane in front of the model,
`atan2` turns that into an angle, and the light sits on a circle of fixed
radius.

Angles cannot be interpolated like ordinary numbers — crossing from pi to
negative pi sends linear interpolation the long way around. `dampAngle` wraps
the difference into [-pi, pi] first, then applies exponential smoothing.

```ts
function createRingLightFollower() {
  const defaultLight = { x: 4, y: 9 }
  const radius = Math.hypot(defaultLight.x, defaultLight.y)
  const defaultAngle = Math.atan2(defaultLight.y, defaultLight.x)
  let targetAngle = defaultAngle
  let currentAngle = defaultAngle

  const dampAngle = (current: number, target: number, lambda: number, dt: number) => {
    const shortest = Math.atan2(
      Math.sin(target - current),
      Math.cos(target - current),
    )
    return current + shortest * (1 - Math.exp(-lambda * dt))
  }

  // mappedX / mappedY come from raycasting pointer UV onto the model plane.
  return (mappedX: number, mappedY: number, inside: boolean, delta: number) => {
    if (inside && mappedX * mappedX + mappedY * mappedY > 1e-6) {
      targetAngle = Math.atan2(mappedY, mappedX)
    } else if (!inside) {
      targetAngle = defaultAngle
    }

    currentAngle = dampAngle(currentAngle, targetAngle, 6, delta)
    return {
      x: radius * Math.cos(currentAngle),
      y: radius * Math.sin(currentAngle),
    }
  }
}
```

### Colored glass for both light and dark modes

For the light theme the tint follows the Beer-Lambert law
(`T = I / I0 = 10^(-epsilon c l)`). The site does not simulate a real spectrum;
an RGB tint represents the colour that survives transmission, and
`pow(tint, thickness)` approximates transmittance. That looked too dim on a dark
background, so dark mode uses Hard Light to lift the colour, with `uDark`
blending between the two. This is a visual adjustment for two very different
backgrounds, not one unified physical model.

```glsl
uniform vec3 uTintColor;
uniform float uTintAmount;
uniform float uThickness;
uniform float uDark;

vec3 hardLight(vec3 base, vec3 blend) {
  vec3 low = 2.0 * base * blend;
  vec3 high = 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
  return mix(low, high, step(vec3(0.5), blend));
}

vec3 applyGlassTint(vec3 color) {
  vec3 tintColor = clamp(uTintColor, 0.001, 1.0);
  float amount = clamp(uTintAmount, 0.0, 1.0);

  // Light mode: Beer-Lambert-inspired absorption.
  vec3 transmittance = pow(tintColor, vec3(max(uThickness, 0.01)));
  vec3 beerColor = mix(color, color * transmittance, amount);

  // Dark mode: an art-directed Hard Light tint.
  vec3 hardColor = mix(
    color,
    hardLight(clamp(color, 0.0, 1.0), tintColor),
    amount
  );

  return mix(beerColor, hardColor, clamp(uDark, 0.0, 1.0));
}
```

### Giving the refraction something to work with

Colourful stickers fall behind the letters so refraction and dispersion have
something to read. A `zOffset` keeps them inside the FBO-sampled scene. Rather
than one mesh and texture per sticker, all PNGs are packed into one
`CanvasTexture` and drawn with a single `InstancedMesh`; the atlas needs only a
`uvRect` and aspect ratio per sticker. Writing the UV rectangles flips Y between
Canvas and WebGL and insets the bounds by half a pixel so linear filtering does
not pick up transparent padding.

```ts
type AtlasImage = CanvasImageSource & { width: number; height: number }

function drawAtlasEntry(
  ctx: CanvasRenderingContext2D,
  image: AtlasImage,
  x: number,
  y: number,
  atlasWidth: number,
  atlasHeight: number,
) {
  ctx.drawImage(image, x, y, image.width, image.height)

  // Canvas is top-left. WebGL UV is bottom-left.
  // The half-pixel inset avoids sampling transparent atlas padding.
  const uvRect = new THREE.Vector4(
    (x + 0.5) / atlasWidth,
    1 - (y + image.height - 0.5) / atlasHeight,
    (image.width - 1) / atlasWidth,
    (image.height - 1) / atlasHeight,
  )

  return { uvRect, aspect: image.width / image.height }
}
```

```ts
// Write CPU particle state into GPU instance attributes.
for (let i = 0; i < visibleCount; i++) {
  const particle = renderParticles[i]
  const aspect = atlas.aspects[particle.textureIndex]
  const uvOffset = particle.textureIndex * 4
  const baseScale = config.scale * particle.scale

  matrixObject.position.copy(particle.position)
  matrixObject.rotation.set(0, 0, particle.rotation)
  matrixObject.scale.set(baseScale * aspect, baseScale, 1)
  matrixObject.updateMatrix()
  mesh.setMatrixAt(i, matrixObject.matrix)

  uvAttribute.setXYZW(
    i,
    atlas.uvRects[uvOffset],
    atlas.uvRects[uvOffset + 1],
    atlas.uvRects[uvOffset + 2],
    atlas.uvRects[uvOffset + 3],
  )
}

mesh.instanceMatrix.needsUpdate = true
uvAttribute.needsUpdate = true
```

---

## 4. Finishing with a retro-futurist visual language

### Making glass feel filmed with a Star 6 filter

A custom lens flare pass keeps the bright core and coloured trail of a flare and
adds six rays on three fixed axes, so the glass reads as something filmed rather
than cleanly rendered.

```glsl
float luma(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

float brightMask(float luminance) {
  // Keep only highlights above the configured threshold.
  float value = max(luminance - uThreshold, 0.0);
  value /= max(1.0 - uThreshold, 1e-5);
  return smoothstep(0.0, 1.0, clamp(value, 0.0, 1.0));
}

vec3 sampleBright(vec2 uv) {
  vec3 color = texture2D(tDiffuse, uv).rgb;
  return color * brightMask(luma(color));
}

vec3 streak(vec2 direction) {
  vec3 result = vec3(0.0);

  // Sample both sides of one axis.
  for (int i = 1; i <= 8; i++) {
    float distancePx = float(i) * 1.5;
    float weight = 1.0 / (1.0 + distancePx * 0.22);
    weight *= weight;

    vec2 offset = direction * distancePx;
    result += sampleBright(vUv + offset) * weight;
    result += sampleBright(vUv - offset) * weight;
  }

  return result;
}

vec3 base = texture2D(tDiffuse, vUv).rgb;
vec3 flare = base * brightMask(luma(base)) * 1.2;
vec2 px = (1.0 / uResolution) * uStreakScale;

// Three axes produce six rays.
flare += streak(vec2(0.0, px.y));
flare += streak(vec2(px.x * 0.8660254,  px.y * 0.5));
flare += streak(vec2(px.x * 0.8660254, -px.y * 0.5));
```

The star texture renders at half resolution and refreshes every other frame,
then composites with the full scene each frame. When the bright section
containing the glass is outside the viewport, the pass stops entirely.

### Dot matrices and character decoding as one system of feedback

A card hover divides the screen into cells and grows a square in each. Loading,
route changes, and the mobile menu use a radial mask, with each cell's alpha
controlling the radius of a circle. They do not share one shader; they share a
visual rule that turns continuous progress into the size of a shape on a fixed
grid.

```glsl
// Card hover: grow a square inside each screen-space cell.
vec2 cardCellUv = fract(screenUv / cellSize);
vec2 fromCenter = abs(cardCellUv - vec2(0.5));
float squareExtent = mix(0.0, 0.5, grow);
float squareDistance = max(fromCenter.x, fromCenter.y);
float squareAa = fwidth(squareDistance) * 1.5;
float squareMask = 1.0 - smoothstep(
  squareExtent - squareAa,
  squareExtent + squareAa,
  squareDistance
);

// Full-screen transition: use the radial mask to grow a circle per cell.
vec2 cellId = floor(uv / pixelSizeUv);
vec2 cellCenter = (cellId + vec2(0.5)) * pixelSizeUv;
float cellAlpha = radialMaskAlpha(cellCenter);
float radius = 0.8 * cellAlpha;
float circleDistance = distance(fract(uv / pixelSizeUv), vec2(0.5));
float circleAa = fwidth(circleDistance) * 1.5;
float circleMask = 1.0 - smoothstep(
  radius - circleAa,
  radius + circleAa,
  circleDistance
);
```

`ScrambleLines` briefly cycles each character through capitals, numbers, and
symbols before settling, like a CLI decoding a message. All text instances share
one 40ms ticker, subscribing only after entering the viewport and unsubscribing
as soon as the animation is done.

---

## Reflections

The most important lesson was to give DOM and WebGL reliable scroll and pointer
data *before* deciding where an effect should appear. CSS owns structure and
accessibility. WebGL comes in when curl, refraction, or a transition adds
something CSS would struggle to express. Shared state and a consistent visual
rule mattered more than the number of effects. If starting again: set the mobile
performance budget and the shutoff conditions for each effect much earlier.

## Credits

- Maxime Heckel, *Refraction, dispersion, and other shader light effects* —
  foundation of the glass refraction and dispersion.
- IUPAC Gold Book, *Beer-Lambert law* — absorption and transmittance definition
  behind the glass tint.
- Lenis and its GitHub repository — smooth scrolling and the host-driven raf
  approach used in the WebGL scroll sync.
- JOYCO, *WebGL Scroll Sync* — additional reference for synchronizing scroll and
  WebGL.
- The site uses TikTok Sans, made open source with help from @Qinyi.
- *Strata – 3D DOM Exploder* by zihan — 3D layer visualization for inspecting
  page structure.
