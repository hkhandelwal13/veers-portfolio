# Veerlabs Portfolio — Build Spec (Claude Code Brief)

> This file is the source of truth for the project. Read it fully at the start of every session.
> It encodes decisions already made with the client. Do not re-litigate them; extend them.

---

## 1. Goal

A retro-futurist portfolio site for a **video editor** to showcase work to clients.
Visual + interaction target: the engineering/interaction of **https://haoqi.design** adapted from a
*design* portfolio (static image cards) to a *video* portfolio (hover-to-play preview cards
+ full showreels on project pages). Brand identity (colors, wordmark, sections) is **Veerlabs' own**.

Reference build article (context, not fetchable by bots):
"Inside HAOQI.DESIGN: Letting DOM and WebGL Share a Retro-Futurist Stage" (Codrops, 2026-08-15).

Figma: client is commissioning a Veerlabs-branded design that reuses haoqi's structure/interactions.
Handoff will be PNG exports (per breakpoint) + SVG assets + a foundations/token list.

---

## 2. Core architectural idea (from the reference)

**DOM and WebGL share one stage. CSS owns layout; WebGL follows.**

- All layout (grid, cards, gaps, ratios, sections) is normal semantic HTML + CSS.
- A full-screen fixed `<canvas>` sits above/below the DOM.
- Each frame, for every "synced" DOM element we read `getBoundingClientRect()` and position a
  matching WebGL plane over it. A `uRect` uniform maps fullscreen UV → each card's local UV.
- **Y-flip**: screen coords start top-left; shader UV starts bottom-left. Flip Y when converting.
- **One render loop.** Lenis drives a single `requestAnimationFrame`; that same tick updates
  smooth-scroll, DOM transforms, and the WebGL scene so 3D never lags the page.

Keep the WebGL layer imperative (refs + `useFrame`). Mutate refs directly per frame.

---

## 3. Locked tech stack

| Concern              | Choice                                                            |
|----------------------|-------------------------------------------------------------------|
| Framework            | Next.js (App Router)                                              |
| 3D                   | React Three Fiber + `@react-three/drei`                          |
| Smooth scroll        | Lenis                                                            |
| Animation            | GSAP (timelines, ScrollTrigger)                                  |
| Glass material       | drei `MeshTransmissionMaterial`, custom GLSL where needed        |
| Signature reveal     | Custom GLSL shader material (dot-matrix)                         |
| Models               | `gltfjsx`-generated R3F components                              |
| CMS                  | Sanity (free tier)                                              |
| **Video hosting**    | **Cloudflare R2 — free tier, zero egress. Self-hosted compressed MP4/WebM** |
| **Video player**     | **Custom styled HTML5 `<video>` element** (no third-party chrome) |
| Font                 | TikTok Sans (open-source variable font)                         |
| Deploy               | Vercel                                                          |

**Canvas is client-only**: dynamic import with `{ ssr: false }`.

---

## 4. Video pipeline (free / zero-cost)

- **No Mux, no paid streaming.** Cloudflare R2 free tier: 10 GB storage, zero egress fees, permanent.
- The client (a video editor) exports web-optimized files themselves:
  - **Preview loop** per project: short (2–4s), muted, small (H.264/WebM) — used on card hover/in-view.
  - **Full video** per project: compressed H.264 MP4 (+ optional WebM) — used on project page.
  - **Poster** image per project: manually set (no auto-poster since we're not on Mux).
- Files live in an R2 bucket, served via its public URL / bound custom domain.
- Sanity stores the **R2 URLs** as plain `url` fields (see schema).
- Playback = a custom-styled HTML5 `<video>` with our own controls.
- Respect `prefers-reduced-motion`: no autoplay, show poster.

---

## 5. Signature effects (full-clone list)

1. **Glass / refraction hero** — `MeshTransmissionMaterial`; extend with custom GLSL for exact
   dispersion + Beer-Lambert tint if needed.
2. **Dot-matrix reveal** — two textures per card; grid of squares grows from card center to
   uncover the second. Reuse SAME language for loader, page transitions, mobile menu.
3. **Hover-to-play video cards** — muted R2 preview loop plays on hover/in-view; click → project page.
4. **Scroll-synced 3D** — `hello.glb` + `arrow.glb` react to scroll position/velocity.
5. **Page transitions** — dot-matrix wipe between routes.

### Dot-matrix shader uniforms (starting contract)
```
uniform sampler2D uTexA;   // preview/poster (or video texture)
uniform sampler2D uTexB;   // second image
uniform vec4  uRect;       // card rect in screen space -> local UV mapping
uniform vec2  uGrid;       // cells across / down (e.g. 24 x 14)
uniform float uProgress;   // 0..1 reveal
uniform vec2  uResolution;
// per cell squareSize from (distanceFromCenter, uProgress); remember the Y-flip
```

---

## 6. Assets on hand

- `public/models/hello.glb` — cursive "hello" (Apple *hello (again)* motif), `water_material`.
  → **LOCKED as the hero element, kept as-is per client.** Static mesh; animate in code
  (float, scroll-react, water/shimmer). Convert + `gltfjsx` to a component.
- `public/models/arrow.glb` — directional arrow. → UI/nav accent, scroll cue, hover indicator.

---

## 7. Sanity content model (R2 URLs, no Mux)

```ts
// project
{
  name: 'project', type: 'document',
  fields: [
    { name: 'title',       type: 'string' },
    { name: 'slug',        type: 'slug', options: { source: 'title' } },
    { name: 'client',      type: 'string' },
    { name: 'role',        type: 'string' },
    { name: 'year',        type: 'number' },
    { name: 'categories',  type: 'array', of: [{ type: 'string' }] },
    { name: 'description', type: 'text' },
    { name: 'credits',     type: 'array', of: [{ type: 'object', fields: [
        { name: 'role', type: 'string' }, { name: 'name', type: 'string' } ] }] },
    { name: 'poster',      type: 'image', options: { hotspot: true } },
    { name: 'previewUrl',  type: 'url' },   // R2 short muted loop
    { name: 'videoUrl',    type: 'url' },   // R2 full showreel
    { name: 'order',       type: 'number' },
    { name: 'featured',    type: 'boolean' },
  ],
}

// siteSettings (singleton)
{
  name: 'siteSettings', type: 'document',
  fields: [
    { name: 'bio',         type: 'text' },
    { name: 'showreelUrl', type: 'url' },   // R2 hero reel
    { name: 'email',       type: 'string' },
    { name: 'socials',     type: 'array', of: [{ type: 'object', fields: [
        { name: 'label', type: 'string' }, { name: 'url', type: 'url' } ] }] },
    { name: 'clientLogos', type: 'array', of: [{ type: 'image' }] },
  ],
}
```

---

## 8. Content still needed

- Design handoff: PNG of every frame (per breakpoint) + SVG logo/icons + foundations/token list.
- Showreel + per-project preview loops + full videos (client-compressed, uploaded to R2).
- Per-project metadata + posters.
- Bio, contact email, socials, client logos.

Build phases 1–3 against placeholder tokens until the design handoff arrives.

---

## 9. Folder structure

```
app/                      # Next routes
  (site)/page.tsx
  work/[slug]/page.tsx
components/
  webgl/                  # Canvas, Scene, SyncedPlane, materials, Hello, Arrow
  dom/                    # Sections, ProjectCard, Menu, Loader, VideoPlayer, Cursor
shaders/                  # glass.glsl, dotmatrix.glsl
lib/                      # sanity client, r2 helpers, lenis, scroll-store, rect-sync
sanity/                   # schema, config, studio
public/models/            # hello.glb, arrow.glb
public/fonts/             # TikTok Sans
```

---

## 10. Phased build plan

1. **Scaffold** — Next + TS + R3F + drei + Lenis + GSAP, client-only Canvas, TikTok Sans, Sanity schema, placeholder tokens.
2. **Static layout** — every section from the design in HTML/CSS, responsive, no WebGL yet.
3. **WebGL layer** — rect-sync system + single render loop + `hello`/`arrow` hero.
4. **Signature effects** — glass, dot-matrix reveal, hover-to-play R2 video cards, loader, transitions, mobile menu.
5. **Content + polish** — real Sanity data + R2 playback, project pages, perf pass, deploy to Vercel.

---

## 11. Performance / rules

- Card hover uses the small preview loop, never the full video.
- Cull off-screen synced planes.
- `prefers-reduced-motion` → static posters, minimal 3D.
- Mobile: simplified or static hero acceptable.
- One rAF loop only; never competing scroll/animation loops.
- Keep R2 usage lean (compress well) to stay inside the free tier.
