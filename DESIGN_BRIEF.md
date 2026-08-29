# Veerlabs Portfolio — Figma Design Brief

Hand this to the designer. It lists exactly what to produce so the design can be built into a
retro-futurist, WebGL-driven portfolio site.

---

## Context (read first)

- This is a **video editor's** portfolio. The engineering and interactions are modeled on
  **haoqi.design** (retro-futurist, translucent iMac-G3 feel, glass, dot-matrix reveals), but the
  **brand identity is Veerlabs' own** — our colors, our wordmark, our sections. It should read as
  "same craft, our brand," not a copy.
- **The layout grid literally drives the 3D layer.** In code, WebGL planes are positioned by
  reading each card/section's on-screen rectangle. So the **grid, card aspect ratios, gaps, and
  spacing must be explicit and numeric, and consistent across every screen.** This is the single
  most important thing to get right.
- The **hero uses a supplied 3D "hello" model** (a cursive, water-like 3D word). The designer does
  **not** design the 3D itself — just reserve and compose the hero space around it (size, position,
  what sits in front/behind, wordmark + nav placement).

---

## Deliverables at a glance

1. A **Foundations / styles** page (color, type, spacing, grid, effects, motion).
2. **Screens** at three breakpoints — **Desktop 1440, Tablet 768, Mobile 390**.
3. A **components** section with states.
4. **Interaction annotations** on the key moments.
5. **Exported assets** — SVG logo + icons, favicon, OG image.

---

## 1. Foundations

**Color** — define as Figma styles/variables, with hex + usage notes:
- Backgrounds, surfaces, glass tint(s), text (primary/secondary/muted), accent(s), lines/borders,
  and any gradients. State whether there's a light and/or dark mode. Lean into the translucent,
  slightly retro palette but make it Veerlabs, not a haoqi copy.

**Typography** — TikTok Sans (open-source variable font) is the reference choice; the designer may
propose an alternative variable font. Provide a full scale with px size, line-height, tracking and
weight for: Display/Hero, H1–H4, Body (L/M/S), Caption, Label/Mono — **desktop and mobile sizes**.

**Spacing & grid (critical)** —
- A spacing scale (4- or 8-based).
- **Desktop grid:** number of columns, gutter, outer margin, max content width.
- **Tablet and mobile grids.**
- **Project card:** exact aspect ratio, columns per breakpoint, and gap. Be precise and consistent.

**Effects** — glass blur amount, tint opacity, borders/highlights; corner radii; shadows; any
grain / scanline / noise overlay.

**Motion notes** (reference feel, not final animation) — easing + duration character; dot-matrix
grid density (cells across × down); reveal direction (spreads from card center).

---

## 2. Screens (Desktop 1440 / Tablet 768 / Mobile 390, each)

1. **Loader** — dot-matrix loading screen.
2. **Home / Hero** — wordmark, nav, reserved area + composition for the 3D "hello", tagline,
   showreel entry point, scroll cue (arrow).
3. **Work / Projects grid** — the card grid; default and **hover state (preview video playing)**;
   category tags / filter.
4. **Project detail** — large custom video player, title / client / role / year, description,
   credits list, category tags, "next project" link.
5. **About** — bio, optional portrait, client logos.
6. **Services** (optional) — e.g. Editing, Color, Motion Graphics.
7. **Contact** — email, socials, a clear CTA.
8. **Navigation & Menu** — desktop nav (default + scrolled states) and the **mobile full-screen
   menu (open state)** in the dot-matrix language.
9. **Footer.**
10. **Page-transition state** — one frame showing the dot-matrix wipe between pages.
11. **404** (optional).

---

## 3. Components (show their states)

- **Nav:** default, scrolled, active link. Menu button. Menu open.
- **Project card:** default, hover (video playing), the two-image/video reveal composition,
  metadata overlay.
- **Custom video player:** play/pause, progress/scrubber, time, mute/unmute, fullscreen, poster
  (idle) state. (We build our own player, so design the controls.)
- **Buttons / links** + hover states.
- **Category tags / filter chips.**
- **Custom cursor** (optional): default, hover-link, hover-video.
- **Scroll cue / arrow.**

---

## 4. Interaction annotations (note the intent; dev implements)

- Cards: on hover / in view a muted **preview loop plays**; click → project page.
- Hero 3D reacts subtly to scroll / pointer.
- Sections reveal on scroll (dot-matrix or fade).
- Route changes use the dot-matrix wipe.
- **Reduced-motion fallback:** static posters, no autoplay.
- Mobile may use a simplified or static hero.

---

## 5. Content model to design around (video-specific)

- **Project:** title, client, role, year, categories[], description, credits [{ role, name }],
  poster image, short preview loop, full video.
- **Category examples:** Commercial, Music Video, Documentary, Short Film, Motion Graphics.
- **Site:** bio, showreel, contact email, socials[], client logos[].

Design the cards and detail page to hold this — especially variable-length titles, multiple
category tags, and a credits list.

---

## 6. Assets to export for development

- **Veerlabs wordmark / logo** — SVG (light + dark variants).
- **Icons** — SVG: arrow(s), menu, close, play, pause, mute/unmute, fullscreen, social icons.
- **Decorative** — grain/noise/scanline and any glass overlay, as PNG or SVG.
- **Favicon set** + **OG/social share image** (1200×630).
- **Poster** aspect ratio + safe-area spec for thumbnails.

---

## 7. Handoff format (so the site can be built from it)

The developer can't open the live Figma, so please also provide:

- **PNG export of every frame at 2x**, organized by breakpoint.
- **SVG exports** for the logo and all icons.
- A **written foundations list**: color hex values, type scale, spacing values, and the grid
  numbers (columns / gutter / margin / max-width / card ratio + gap).
- **Clear frame names**, e.g. `Desktop / Home`, `Mobile / Work`, `Tablet / Project`.
- A short **prototype or annotations** for the key interactions in section 4.

The clearer and more numeric the grid and card specs, the more faithfully the WebGL layer will line
up with the design.
