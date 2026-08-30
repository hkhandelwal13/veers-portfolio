/**
 * Sticker atlas manifest.
 *
 * `public/stickers/stickers.json` ships prebuilt alongside the packed PNG, so
 * nothing is packed at runtime (DECISIONS: "use it if present"). Each entry
 * carries a uvRect already in GL convention — origin bottom-left, Y flipped
 * relative to the canvas it was packed from.
 */

export type StickerEntry = {
  name: string
  x: number
  y: number
  w: number
  h: number
  aspect: number
  /** [u, v, du, dv], origin bottom-left. */
  uvRect: [number, number, number, number]
}

export type StickerAtlas = {
  atlas: string
  width: number
  height: number
  stickers: StickerEntry[]
}

export const STICKER_ATLAS_URL = '/stickers/stickers-atlas.png'
export const STICKER_MANIFEST_URL = '/stickers/stickers.json'

/**
 * Pulls each rect half a pixel inward.
 *
 * Bilinear filtering samples beyond a rect's edge, and in a packed atlas what
 * lies beyond is the neighbouring sticker's transparent padding — which shows
 * up as a faint halo around every sticker. Half a texel of inset costs nothing
 * visible and removes it.
 */
export function insetUvRect(
  rect: [number, number, number, number],
  atlasWidth: number,
  atlasHeight: number,
): [number, number, number, number] {
  const halfU = 0.5 / atlasWidth
  const halfV = 0.5 / atlasHeight
  return [rect[0] + halfU, rect[1] + halfV, rect[2] - halfU * 2, rect[3] - halfV * 2]
}

export async function loadStickerAtlas(signal?: AbortSignal): Promise<StickerAtlas | null> {
  try {
    const response = await fetch(STICKER_MANIFEST_URL, { signal })
    if (!response.ok) return null
    const data = (await response.json()) as StickerAtlas
    if (!Array.isArray(data.stickers) || data.stickers.length === 0) return null
    return data
  } catch {
    // A missing or malformed manifest just means no stickers; the glass still
    // renders, it simply has less to refract.
    return null
  }
}
