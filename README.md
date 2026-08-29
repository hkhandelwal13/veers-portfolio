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

`components/providers/SmoothScrollProvider.tsx` holds the **only**
`requestAnimationFrame` in the app. Each tick, in order:

1. Lenis advances smooth scroll and writes the offset to the DOM
2. GSAP ScrollTrigger recomputes against that fresh offset
3. R3F renders via `advance()`

The `<Canvas>` is mounted `frameloop="never"` precisely so it has no loop of its
own. Because step 3 runs after 1–2 *in the same frame*, the 3D layer always reads
the scroll position the DOM was just painted at — so WebGL can never lag a frame
behind the elements it tracks. **Never add a second rAF or a second Lenis
instance** (use `getLenis()`); that's what breaks the sync.

Per-frame code is deliberately imperative — mutate refs in `useFrame`, read
scroll from `lib/scroll-store.ts`. Don't put per-frame values in React state.

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
shaders/    (Phase 4)
public/     models/*.glb, fonts/
```

---

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
