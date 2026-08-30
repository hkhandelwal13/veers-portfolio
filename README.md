# Veerlabs Portfolio

Retro-futurist portfolio for a video editor. See **CLAUDE.md** for the full build
spec (it's the source of truth) and **DESIGN_BRIEF.md** for the Figma handoff ask.

Stack: Next.js 16 (App Router, TypeScript) · React Three Fiber + drei · Lenis ·
GSAP · Sanity · Cloudflare R2 for video · TikTok Sans + Space Mono
(self-hosted).

---

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
```

It runs with **no accounts and no env vars** — Sanity helpers return empty and
the page falls back to placeholder content. Set things up when you're ready.

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

---

## Accounts you need

Neither is needed to develop Phases 1–3. Both are free.

### 1. Sanity — CMS (free tier)

1. Sign up at [sanity.io](https://www.sanity.io) and create a project
   (dataset: `production`).
2. Copy the **Project ID** from
   [sanity.io/manage](https://www.sanity.io/manage) → your project → *Settings*.
3. `cp .env.local.example .env.local` and fill in
   `NEXT_PUBLIC_SANITY_PROJECT_ID`.
4. In *API → CORS origins*, add `http://localhost:3000` **with credentials
   allowed**, plus your Vercel URL once deployed.
5. Restart `npm run dev` and open **http://localhost:3000/studio** to edit
   content. The schema (Project + Site settings) is already wired.

The dataset must be **public** for the site to read it without a token — that's
the normal setup for a portfolio, and it keeps us off paid API tiers.

### 2. Cloudflare R2 — video hosting (free tier)

Chosen over Mux because R2 has **zero egress fees**: 10 GB storage free, and
bandwidth costs nothing however much the reel gets watched.

1. Sign up at [cloudflare.com](https://dash.cloudflare.com) → **R2** → *Create
   bucket* (e.g. `veerlabs-media`). R2 asks for a card to activate even on the
   free plan; it won't charge within free limits.
2. Bucket → *Settings* → **Public access**: either enable the `r2.dev` public
   URL, or connect a custom domain like `media.veerlabs.com` (recommended —
   faster, and the URL doesn't change if the bucket does).
3. Upload the exported files (drag-and-drop in the dashboard is fine).
4. Paste each file's public URL into the matching Sanity field
   (`previewUrl`, `videoUrl`, `showreelUrl`).

Optionally set `NEXT_PUBLIC_R2_PUBLIC_URL` in `.env.local` — only needed if you'd
rather store bare object keys (`work/atlas-preview.mp4`) in Sanity than full
URLs. `lib/r2.ts` resolves both.

**What to export** (per CLAUDE.md §4 — the editor does the compression):

| File | Spec |
| --- | --- |
| Preview loop | 2–4s, **muted**, small, H.264 MP4 (+ WebM optional) — card hover |
| Full video | Compressed H.264 MP4 — project page only |
| Poster | Still image, uploaded to Sanity (not R2) |

Keep files lean so 10 GB lasts.

### 3. Vercel — deploy (later, Phase 5)

Import the repo, add the same env vars, deploy. Nothing to do yet.

---

## How the render loop works

The one architectural decision everything else hangs off (CLAUDE.md §2):
**CSS owns layout; WebGL follows.**

There is exactly one `requestAnimationFrame` in the app, and R3F owns it.
`components/webgl/FrameDriver.tsx` registers an `addEffect` callback that runs
`lib/frame-loop.ts`, which each frame does, in this order:

1. `lenis.raf()` — smooth scroll advances and writes the DOM
2. `updateScrollBus()` — records what Lenis just produced, for this frame
3. `commitPointerBus()` — eases the pointer, republishes its snapshot

R3F then walks its `useFrame` subscribers and renders. `addEffect` fires before
any subscriber and before `gl.render`, so the order within a frame is:

```
addEffect      lenis.raf → ScrollBus → PointerBus
useFrame(-3)   RectSampler refreshes DOM rects
useFrame(0)    meshes consume those rects
gl.render      the frame is drawn
```

That ordering is the whole point. With Lenis and R3F each owning their own rAF,
R3F could run first and read *last* frame's scroll while the DOM had already
moved — a one-frame slip that no amount of interpolation tuning fixes, because
the cause is execution order. Measured on this build: at ~9000px/s the model
stays within **2.7px** of its DOM rect, and the residual alternates with scroll
direction rather than accumulating, so it is measurement quantisation rather
than lag.

**Never add a second rAF or a second Lenis instance** (use `getLenis()`).

**The fallback matters.** The canvas is a dynamic, client-only import and may
never mount — no WebGL, a failed chunk, an old device. Lenis runs with
`autoRaf: false`, so an unticked Lenis is a page that cannot scroll at all.
`SmoothScrollProvider` therefore starts a fallback rAF that drives the same
`runFrame`, and `claimFrameLoop()` / `releaseFrameLoop()` make sure exactly one
driver is live at a time. Verified by stubbing out `getContext('webgl')`:
scrolling still works and the CSS poster fallback comes back.

Per-frame code is deliberately imperative — mutate refs in `useFrame`, read
`getScrollSnapshot()` and `pointer` directly. Don't put per-frame values in
React state. React reads the buses only through `lib/use-scroll.ts`, and only
where scroll genuinely changes DOM output (the nav's scrolled state uses
`useScrollFlag`, which returns a boolean so React bails out until it flips).

---

## Layout

```
app/
  (site)/page.tsx            home
  work/[slug]/page.tsx       project detail (stub)
  studio/[[...tool]]/        embedded Sanity Studio
  layout.tsx  globals.css    ← all design tokens live here
components/
  webgl/    Scene, WebGLCanvas, HeroHello, Hello, Arrow
  dom/      placeholder sections
  providers/SmoothScrollProvider  ← the render loop
lib/
  lenis.ts  scroll-store.ts  r2.ts  sanity/
sanity/     schema, structure, env
shaders/    dom-sync.ts (card mirror + dot-matrix reveal; glass is Phase 4)
public/     models/*.glb, fonts/
```

---

## Status — Phase 4 in progress

Running item-by-item per PHASE4_KICKOFF.md, each built fresh from the method in
`design/haoqi-article.md`.

**Items 1–3 done: dot-matrix hover reveal, develop-on-enter,
scroll-velocity curl.** All three ride on the same mirrored card mesh, so they
share one shader and one set of shutoffs.

**Item 1 — dot-matrix hover reveal.** Two textures per card; the screen is
divided into fixed cells and a square grows inside each one as the wave spreads
from the card's centre, uncovering the second texture. `uRect` maps fullscreen
UV into card-local UV and the wave distance is aspect-corrected, so the front
reaches all four edges together instead of arriving at the sides first.

Two decisions worth knowing:

- **The cells are anchored to the screen, not the card.** That is what makes the
  grid read as one matrix laid over the page rather than a texture belonging to
  each card, and it is the rule the loader and page transitions will follow.
- **Constant-speed sweep, not exponential damping.** Damping front-loads the
  motion and then crawls, so the squares pop near the centre and the growth is
  over before the eye catches it. The wavefront now crosses at a steady rate
  over ~450ms, roughly matching `--dur-med` so the WebGL reveal and the DOM
  metadata scrim land together.
- **Squares overshoot the cell.** Stopping at exactly half a cell leaves a
  hairline of base texture at every boundary, so a fully revealed card keeps a
  grid stamped over it permanently. Past that the squares close up and the
  matrix is visible only while the reveal is moving.

The DOM overlay that used to be an opaque dark panel is now a bottom scrim
carrying only the badge, title, role and view affordance — an opaque background
there would hide the effect it belongs to.

**Item 2 — develop-on-enter.** A card blends up from its negative over 0.8s
when it enters the viewport, and snaps back to zero once it has fully left so
it replays on return. The cull margin keeps a card alive slightly beyond the
viewport, so "entered" is tested separately and strictly — the card has to be
genuinely on screen before it starts developing.

**Item 3 — scroll-velocity curl.** A semicircular profile across the card's
height compresses the sampled X near the top and bottom, so cards flex slightly
with scroll speed while their middles hold still.

- **The signal lives on the frame loop**, not in each card. `lib/scroll-activity.ts`
  derives it once per frame straight after the ScrollBus is written, so every
  card reads the same number for the same frame.
- **Fast attack, slow release** (25ms / 175ms). A trackpad produces constant
  small velocity fluctuations; one time constant turns those into flicker,
  whereas rising quickly and falling gently reads as momentum. `dt` is clamped
  so a backgrounded tab waking up cannot spike the signal on its first frame
  back.
- **Applied in card-local space, not screen space.** The article describes the
  middle of the *image* holding still, and card-local keeps the flex from
  dragging a card's edges off the DOM rect it is mirroring — the `inside` mask
  deliberately stays on the undistorted UV.

### Effect shutoffs

`lib/capabilities.ts` is the single place shutoff conditions are decided, added
now rather than retrofitted (the article's closing lesson). It watches three
live media queries — reduced motion, hover capability, compact viewport — and
exposes one named gate per effect.

Verified in a real browser at production constants:

| Effect | Reduced motion | Touch / no hover | Small screen | Offscreen |
| --- | --- | --- | --- | --- |
| Hover reveal | reveals, but snaps | holds the poster (0.003) | — | resets, replays |
| Develop on enter | skipped entirely | unaffected | kept — one mix | resets, replays |
| Scroll curl | off | — | off | mesh hidden |

Measurements: hover reveals 0 → 0.985 dark and holds at 0.003 under
`hover: none`; develop swings 189 → 225 brightness on re-entry and is flat under
reduced motion; the curl signal reads 0 at rest, peaks at 0.99 during a fast
scroll and decays to 0.004, showing the intended fast attack and slow release.

Two notes on how that was checked. Timing-based effects were also verified with
their constants temporarily slowed, because a screenshot round-trip is ~300ms
and cannot resolve a 450ms sweep otherwise. And emulating a touch device needs
`hasTouch` set at context creation as well as the CDP media override —
without it Playwright resets the emulated features on navigation and the
override is silently discarded, which makes a broken shutoff look like a
working one.

`?webgl=debug` reflects the live capability values onto `<html>`
(`data-cap-hover`, `data-cap-reduced-motion`, `data-cap-compact`), so you can
see *why* an effect is off on a given device without reading the source. It
also publishes the live effect signals (`data-scroll-activity`,
`data-pointer-uv`, `data-pointer-inside`) — the per-frame numbers that drive
the effects never reach React, which otherwise makes it impossible to tell a
wrong shader from a stuck input.

### Still to come in Phase 4

The glass `hello` (FBO two-pass
refraction/dispersion, ring-constrained rim light, Beer-Lambert / Hard-Light
tint), floating stickers, the Star-6 lens flare, dot-matrix transitions,
ScrambleLines, and the watery cursor.

**Blocked on design assets** (PHASE4_KICKOFF "Depends on"): the sticker PNG set,
glass tint colour(s), the light/dark theme decision, and the two-image card
decision. The reveal currently uncovers a generated dark preview panel; whether
that becomes a second still or the muted R2 preview clip is that open decision.
Nothing downstream cares which — CardMirror samples two textures and the shader
blends them, whatever they are.

## Status — Phase 3 (DOM ↔ WebGL foundation) complete

Built fresh from the method described in `design/haoqi-article.md` and the
public sources it credits (Lenis host-raf; JOYCO WebGL Scroll Sync), per
PHASE3_KICKOFF.md.

| System | Where |
| --- | --- |
| ScrollBus — one snapshot per frame | `lib/scroll-bus.ts` |
| PointerBus — one 0–1 UV, `inside` flag, recentres | `lib/pointer-bus.ts` |
| The single frame loop + fallback | `lib/frame-loop.ts` |
| DomTargetRectSampler | `lib/rect-sampler.ts` |
| R3F driver / sampler runner | `components/webgl/FrameDriver.tsx`, `RectSampler.tsx` |
| `uRect` card mirroring | `components/webgl/CardMirror.tsx`, `shaders/dom-sync.ts` |
| `hello` seated in its DOM rect | `components/webgl/HeroHello.tsx` |

**The rect cache.** Measuring every registered element every frame means a
forced synchronous layout per element, so the sampler keeps a cache three ways:
every rect is shifted by the frame's scroll delta (scrolling moves them all by
exactly the same amount); targets near the viewport are re-measured every frame
anyway; distant ones refresh every ~12 frames, staggered by index so they never
bunch onto one frame. Nothing touches React state.

**Verified in the browser**, not just by reading the code:

- Model seated at **720 × 360 @ x360 y300** on desktop, in flow at 350 × 180 on
  mobile; card boxes measure **628 × 353** at 1440 — the wireframe's hard spec.
- Scroll lock: worst slip **2.7px** at ~9000px/s, non-accumulating.
- Cards mirrored at 1440 / 768 / 390, with zero pixel variance immediately
  outside each box — the `inside` mask clips correctly and the Y-flip is right.
- Pointer parallax swings the model **33px**; it settles to within **1.1px** of
  centre on pointer-leave and **1.5px** on window blur.
- Under `prefers-reduced-motion` the model's centroid is *identical* to two
  decimal places across every pointer position — it sits exactly on its seat
  with no float and no parallax.

### Checking alignment yourself

Append `?webgl=debug` to any page (e.g. `/?webgl=debug`) to outline every
`data-webgl` rect. The outline is drawn with `outline`, not `border`, and has no
fill, so it adds no box size and cannot tint what it is measuring.

### Not built yet, by design

No glass, stickers, dot-matrix, curl, or post-processing — all Phase 4. `hello`
still wears its baked `water_material3`, and the mirrored cards sample a flat
placeholder poster texture (Phase 5 swaps in the real poster from Sanity; the
mirroring code does not care which texture it samples).

Two deliberate departures from the kickoff, both noted where they occur:

- **GSAP is no longer in the loop.** Phase 1 drove the frame from
  `gsap.ticker`; R3F drives it now, and leaving GSAP's ticker running would be
  the second rAF CLAUDE.md §11 forbids. Nothing currently uses GSAP. When
  Phase 4 adds timelines, wire them by removing `gsap.updateRoot` from
  `gsap.ticker` and calling it from `runFrame` instead.
- **No camera parallax.** `rectToWorld` already accounts for the camera's
  position, so animating it is safe — but with the model glued to its rect, a
  moving camera would move everything *except* the model, which is not the
  effect the kickoff is after. Model parallax only.

## Status — Phase 2 (Static Layout) complete

Every screen from `design/Veerlabs Wireframes.dc.html` is built as semantic
components at 1440 / 768 / 390:

| Screen | Route | Wireframe |
| --- | --- | --- |
| Loader | overlay, once per session | 1a |
| Home / Hero | `/` | 1b |
| Work grid | `/work` (and on `/`) | 1c |
| Project detail (dark) | `/work/[slug]` | 1d |
| About | `/about` | 1e |
| Services | `/services` | 1f |
| Contact | `/contact` | 1g |
| Nav + mobile menu | shared chrome | 1h |
| Footer | shared chrome | 1i |

Also done: the four-corner HUD as one shared overlay with a live GMT+5:30
clock; both fonts self-hosted; tokens from PHASE2_KICKOFF.md in `:root`;
reserved 3D placeholders; accessible markup (skip link, landmarks, one `h1`
per screen, focus-visible, a modal mobile menu with focus trap and restore).

Not built, by design: the dot-matrix reveal and glass shaders (Phase 4). The
loader's grid, the card hover overlay and the player chrome are all static
structure reserving the space those effects will fill.

### Tokens and the two source documents

`PHASE2_KICKOFF.md` is the token source of truth; the wireframes supply
structure and spacing. Where they disagree, the kickoff won:

- **Page background** — kickoff `--bg: #e7e4dd` with `--surface: #f4f2ed` for
  panels. The wireframe painted whole screens `#f4f2ed`; if that flatter look
  is wanted, change `--bg` to match `--surface`.
- **Tablet margin** — kickoff 40px, wireframe 32px. Using 40, which is why the
  tablet reserved-3D box measures 688 wide rather than the wireframe's 704.
- **Gutter** — the kickoff gives one value (24px); the wireframes step it down
  per breakpoint (24 / 16 / 12), which is what's implemented.
- **Accent is still open** (kickoff flags it). The defaults are in place and
  applied the way the wireframes actually use them: lime `--accent-2` carries
  every interactive state that appears in an approved screen (active nav,
  hover, scrubber), and blue `--accent` is the system accent — reserved-3D
  outlines and focus rings, exactly its role in the wireframes.

### Reserved 3D placeholders

Empty positioned boxes, marked `data-webgl="hero-hello"` and
`data-webgl="wordmark"`. Verified bounds:

| Breakpoint | Measured |
| --- | --- |
| Desktop 1440 | 720 × 360 @ x360 y300 — exact spec |
| Tablet 768 | 688 × 220, in flow |
| Mobile 390 | 350 × 180, in flow — exact spec |

Desktop bounds are percentages of the full-bleed section (25% / 33.3% / 50% /
40%), so they hold at any width; below desktop they drop into normal flow at
the wireframes' tablet and mobile sizes. Bounds are passed as CSS custom
properties rather than literal inline styles precisely so the stylesheet can
reflow them. `showMarker={false}` hides the dashed dev outline.

The Phase-1 Canvas is untouched and still renders the `hello` model fitted to
the viewport, so it currently floats near — but is not bound to — the hero
slot. Phase 3 binds it to these rects.

### Notes for whoever picks this up

- **The HUD's bottom row hands off to the footer.** The footer carries its own
  telemetry row (wireframe 1i), so an IntersectionObserver fades the HUD's
  bottom row out once the footer is in view. The top-left wordmark never
  hides — it's the home link.
- **`lib/` stays free of three.js.** The buses, the frame loop and the rect
  cache are plain modules, and `WebGLTarget` / `card-target-id` sit on the DOM
  side of the bridge. `SmoothScrollProvider` renders on every page, so importing
  the WebGL runtime there would defeat the dynamic canvas-only import.
- **Chrome surface tokens.** Nav, HUD and footer mount above the route and
  can't see which surface a screen paints, so they read `--chrome-ink`,
  `--chrome-muted` and `--chrome-tint`. `<SurfaceTheme value="dark" />` sets
  `data-surface` on `<html>` to flip them; the project detail page uses it.
  Without this the active nav link renders in ink on a dark page — invisible.
- **The mobile menu's `visibility` is stepped, not eased.** It flips to visible
  immediately on open and is delayed to the end of the fade on close. Easing it
  leaves the panel hidden when focus moves in, and a hidden element silently
  refuses focus.
- **`MobileMenu`'s `onClose` must be referentially stable** (it's a
  `useCallback` in `Nav`). An unstable one re-runs the focus effect on every
  parent render, and its cleanup drags focus back to the trigger.
- The grid values (`--columns`, `--gutter`, `--card-ratio`) are the contract
  between CSS and WebGL from Phase 3 on.
- Filter chips and "Load more" are deliberately non-interactive markup —
  wiring them needs real data (Phase 5), and a control that looks clickable
  but does nothing is worse than one that reads as a label.
- `lib/sanity/*` is intact but unused by these screens: Phase 2 is static
  layout against `lib/placeholder-content.ts`, and Phase 5 reconnects it.
- Both `.glb`s are meshopt-compressed; drei's `useGLTF` decodes that locally,
  no CDN fetch. The scene's environment is built from `<Lightformer>`s rather
  than an HDRI preset for the same reason.
- `agentRules: false` in `next.config.ts` stops `next dev` appending its own
  block to CLAUDE.md, which is the client's spec doc.
- `npm audit` reports issues in transitive deps of the Sanity **Studio**
  (dev-only, not shipped to visitors). Fixing them needs breaking major bumps;
  left alone deliberately.

### Next — Phase 3

Wire the rect-sync system to the `data-webgl` placeholders: read each box's
`getBoundingClientRect()` on the single rAF loop and position a WebGL plane
over it.
