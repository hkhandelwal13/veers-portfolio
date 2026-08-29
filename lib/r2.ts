/**
 * Cloudflare R2 helpers (CLAUDE.md §4).
 *
 * Sanity stores absolute R2 URLs, so most of the time there's nothing to do.
 * These exist for the case where the client would rather store bare object keys
 * ("work/atlas-preview.mp4") — then NEXT_PUBLIC_R2_PUBLIC_URL resolves them.
 *
 * Nothing here uploads: the client exports and uploads their own compressed
 * files, and zero egress is the whole reason we're on R2 rather than Mux.
 */

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ''

/** Resolves an R2 object key or passes an absolute URL straight through. */
export function r2Url(keyOrUrl: string | undefined | null): string | null {
  if (!keyOrUrl) return null
  if (/^https?:\/\//i.test(keyOrUrl)) return keyOrUrl
  if (!R2_PUBLIC_URL) return null
  return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${keyOrUrl.replace(/^\//, '')}`
}

/**
 * Source list for a <video>. Prefers WebM where the client has exported one —
 * the browser takes the first type it can play.
 */
export function videoSources(url: string | null): { src: string; type: string }[] {
  if (!url) return []
  const type = url.endsWith('.webm') ? 'video/webm' : 'video/mp4'
  return [{ src: url, type }]
}
