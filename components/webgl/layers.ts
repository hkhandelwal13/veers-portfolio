/**
 * Render layers.
 *
 * The glass needs a picture of the scene *without itself* to refract, the lens
 * flare needs a picture of *only* the glass to find highlights in, and the
 * cursor lens needs one that *includes* the glass — it passes over the word and
 * has to bend it. Layers are how one scene serves all four passes without
 * duplicating objects: each pass points the camera at a different subset.
 *
 * Anything not explicitly assigned stays on CONTENT, which is three's default.
 */
export const LAYER_CONTENT = 0 /** cards, stickers — everything the glass refracts */
export const LAYER_GLASS = 1 /** the glass word alone */
export const LAYER_OVERLAY = 2 /** the flare composite, drawn over the finished frame */
export const LAYER_LENS = 3 /** the cursor lens — refracts the word as well as the ground */

/** Every layer, for the on-screen render. */
export const ALL_LAYERS_MASK =
  (1 << LAYER_CONTENT) | (1 << LAYER_GLASS) | (1 << LAYER_OVERLAY) | (1 << LAYER_LENS)
