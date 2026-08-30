# Locked decisions (read alongside CLAUDE.md)

## Two-image card reveal (unblocks the dot-matrix hover)
- Base texture = project **poster**.
- Reveal texture = the **muted R2 preview clip** (a VideoTexture as the second texture), so the
  dot-matrix uncovers motion, not a still.
- Fallback: a second **still image** where a clip isn't available.
- No architecture change — CardMirror samples two textures and the shader blends them either way;
  the second sampler just becomes a VideoTexture when a clip exists.

## Glass tint (unblocks item 4)
- Body tint = a **luminous azure/cyan** (start ~`#1FA2FF`) — NOT the flat ultramarine `#0047ff`,
  because Beer-Lambert (`pow(tint, thickness)`) darkens saturated blues into mud.
- Rim-light glint = the **lime `#b8e614`** as a thin edge accent only, not the body.
- Treat these as starting values and tune live in-browser.

## Theme (unblocks item 4's uDark path)
- **Dark-first** is primary (video reads better on dark). Light = the warm-greige system as the
  secondary theme via the THEME toggle.
- Build the glass with the `uDark` blend (Beer-Lambert in light, Hard-Light in dark); tune the dark
  tint first, then the light one.

## Stickers (unblocks item 5)
- Individual trimmed transparent PNGs in `public/stickers/`, packed into one CanvasTexture atlas +
  single InstancedMesh (a prebuilt atlas + uvRects manifest may be provided — use it if present,
  else pack at runtime).

## Assets ready
- Editor face: `face-color.png` + `face-depth.png` in `public/` (white = near, black = far,
  background forced far). 2.5D displacement + PointerBus parallax; flat-photo fallback.

## Sequencing
- Proceed now: item 2 (develop-on-enter), item 3 (curl).
- Item 4 (glass): unblocked by the tint above.
- Item 5 (stickers): when the set lands.
- Item 6 (star flare): after the glass.
