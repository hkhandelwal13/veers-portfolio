/**
 * The temperature in the HUD's bottom-left corner.
 *
 * Open-Meteo, because it needs no key and no account: a key would have to ship
 * in the bundle, where it is not a key. The request carries a city centroid
 * from lib/zone-places, never a visitor's own position — nothing here asks for
 * geolocation permission and nothing looks up an IP.
 *
 * Failure is not an error state. A blocked request, an offline visitor, a zone
 * that is not in the table: the corner shows the clock and no temperature, and
 * nothing is logged or retried in a loop. It is decoration on a portfolio.
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
const CACHE_KEY = 'vl-temp'
/** Weather does not move fast enough to refetch on every route change. */
const CACHE_MS = 15 * 60 * 1000
/** Past this, assume it is not coming and leave the corner alone. */
const TIMEOUT_MS = 6000

type Cached = { at: number; lat: number; lon: number; c: number }

function readCache(lat: number, lon: number): number | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as Cached
    if (Date.now() - cached.at > CACHE_MS) return null
    // Guard against a stale entry from a different place — a laptop that
    // changed timezone between loads in the same tab.
    if (cached.lat !== lat || cached.lon !== lon) return null
    return typeof cached.c === 'number' ? cached.c : null
  } catch {
    return null
  }
}

function writeCache(lat: number, lon: number, c: number) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), lat, lon, c } satisfies Cached))
  } catch {
    // Private mode or blocked storage: it will simply fetch again next time.
  }
}

/** Degrees Celsius, rounded, or null if it could not be had. */
export async function fetchTemperature(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<number | null> {
  if (typeof window === 'undefined') return null

  const cached = readCache(lat, lon)
  if (cached !== null) return cached

  const url = `${ENDPOINT}?latitude=${lat}&longitude=${lon}&current=temperature_2m`

  // Its own timeout, combined with the caller's: an abort controller that only
  // fires on unmount would leave a hung request holding a connection open for
  // as long as the tab is up.
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS)
  signal?.addEventListener('abort', () => timeout.abort(), { once: true })

  try {
    const response = await fetch(url, { signal: timeout.signal })
    if (!response.ok) return null
    const body: unknown = await response.json()
    const value = (body as { current?: { temperature_2m?: unknown } })?.current?.temperature_2m
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    const rounded = Math.round(value)
    writeCache(lat, lon, rounded)
    return rounded
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
