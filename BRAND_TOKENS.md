# Veerlabs brand palette (from the supplied swatch)

Source of truth for accents — supersedes the placeholder accents guessed from the wireframes
(the old `#0047ff` / `#b8e614`). Reconcile the warm-greige neutrals from PHASE2 tokens with these.

| Name            | Hex       |
|-----------------|-----------|
| Sunny Yellow    | `#FFB500` |
| Ocean Blue      | `#4E76D0` |
| Sky Blue        | `#8EBFE8` |
| Forest Green    | `#01561D` |
| Emerald Green   | `#00936D` |
| Lavender Purple | `#4F467F` |
| Grape Purple    | `#8885D2` |
| Ruby Red        | `#FC6E48` |
| Quartz Pink     | `#FF9BA5` |
| Stone Gray      | `#C6C6C6` |
| Off White       | `#F3F2F5` |

## Roles (suggested)
- Surfaces: Off White `#F3F2F5` (light surface), Stone Gray `#C6C6C6` (lines/fills).
- Primary accent: Ocean Blue `#4E76D0`. Interaction/hover: Emerald `#00936D` or Ruby `#FC6E48`.
- The vivid set (yellow/purple/pink/green) reads as the sticker/retro-futurist accent family.

## Glass tint — updated to brand (supersedes the earlier ~#1FA2FF guess)
- **Body tint = Sky Blue `#8EBFE8`** — light and luminous, so Beer-Lambert (`pow(tint, thickness)`)
  keeps the glass bright instead of muddy.
- **Dark-mode / deeper variant = Ocean Blue `#4E76D0`** via the `uDark` path.
- Rim-light glint: keep near-white, or a touch of Sunny Yellow `#FFB500` for warmth.
- Still tune live in-browser.
