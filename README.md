# Veerlabs Portfolio

Retro-futurist portfolio for a video editor. See **CLAUDE.md** for the full build
spec (it's the source of truth) and **DESIGN_BRIEF.md** for the Figma handoff ask.

Stack: Next.js 16 (App Router, TypeScript) · React Three Fiber + drei · Lenis ·
GSAP · Sanity · Cloudflare R2 for video · TikTok Sans (self-hosted).

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

## Status — Phase 1 (Scaffold) complete

Done: Next + TS + R3F + drei + Lenis + GSAP wired; client-only Canvas; the
`hello` model as hero, auto-fitted and reacting to scroll and pointer; single
rAF loop; TikTok Sans self-hosted; Sanity schema + Studio; placeholder tokens;
`prefers-reduced-motion` respected.

Not started (by design): the signature shaders. Glass /
`MeshTransmissionMaterial`, the dot-matrix reveal, hover-to-play video cards,
loader and page transitions are Phase 4. `hello` still wears its baked
`water_material3`.

Next up — **Phase 2**: build every section as static HTML/CSS from the design
handoff. Then **Phase 3**: the rect-sync system that maps `getBoundingClientRect()`
onto WebGL planes.

### Notes for whoever picks this up

- **Design tokens are placeholders.** Every value is in `:root` in
  `app/globals.css`. Swap that block at handoff; no component hard-codes a
  colour or size.
- The grid values (`--grid-columns`, `--grid-gutter`, `--card-ratio`) are the
  contract between CSS and WebGL from Phase 3 on. Cards already carry
  `data-webgl-slot` for the rect-sync system to find.
- Both `.glb`s are meshopt-compressed; drei's `useGLTF` decodes that locally,
  no CDN fetch. The scene's environment is built from `<Lightformer>`s rather
  than an HDRI preset for the same reason — nothing loads from a third party.
- `agentRules: false` in `next.config.ts` stops `next dev` appending its own
  block to CLAUDE.md, which is the client's spec doc.
- `npm audit` reports issues in transitive deps of the Sanity **Studio**
  (dev-only, not shipped to visitors). Fixing them needs breaking major bumps;
  left alone deliberately.
