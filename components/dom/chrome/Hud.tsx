'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import styles from './Hud.module.css'
import { pointerRaw, subscribeToPointer } from '@/lib/pointer-bus'
import { fetchTemperature } from '@/lib/weather'
import { getTimeZone, getZonePlace, type ZonePlace } from '@/lib/zone-places'

/**
 * Four-corner HUD (PHASE2_KICKOFF "HUD motif") — built once, mounted in the
 * site layout, shared by every screen:
 *
 *   top-left      the mark and the VEERLABS wordmark (the nav does not repeat
 *                 them; this slot sits inside the nav's floating bar)
 *   bottom-left   the visitor's own zone, country, clock and temperature
 *   bottom-centre the pointer's position, live
 *   bottom-right  a turning globe
 *
 * Everything in the bottom row is the visitor's, not the studio's. It used to
 * be the studio's local time and a per-screen status line, which is a caption;
 * a readout that answers questions about *you* is telemetry, which is what the
 * motif is pretending to be.
 *
 * The overlay is pointer-events:none so it never blocks the page; the wordmark
 * link opts back in. Its ink follows the --chrome-* tokens, so it inverts on
 * dark screens without needing to be told which page it's on.
 */

/**
 * The visitor's UTC offset, as the HUD prints it.
 *
 * `shortOffset` gives "GMT+5:30" on some engines and "GMT+05:30" on others, so
 * the leading zero comes off here — otherwise the corner reads differently in
 * Chrome and Safari on the same machine.
 */
function zoneLabel(): string | null {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'shortOffset' }).formatToParts(
      new Date(),
    )
    const name = parts.find((part) => part.type === 'timeZoneName')?.value
    return name ? name.replace(/([+-])0(\d)/, '$1$2') : null
  } catch {
    return null
  }
}

/*
 * The zone and the place it implies, read from the browser once and then held.
 *
 * Through useSyncExternalStore with a subscribe that never fires, rather than
 * through an effect that sets state: neither value can change while the tab is
 * open, and an effect would render the corner empty and then render it again a
 * beat later — a visible flicker in exchange for nothing. The server snapshot
 * is null on purpose, because the server has no idea where the visitor is and
 * guessing is a hydration mismatch.
 *
 * Memoised at module level because getSnapshot must return the same value each
 * call: a fresh object every time is an infinite render loop.
 */
const NEVER_CHANGES = () => () => {}

let zoneMemo: string | null | undefined
function readZone(): string | null {
  if (zoneMemo === undefined) zoneMemo = zoneLabel()
  return zoneMemo
}

let placeMemo: ZonePlace | null | undefined
function readPlace(): ZonePlace | null {
  if (placeMemo === undefined) placeMemo = getZonePlace(getTimeZone())
  return placeMemo
}

const noZone = () => null
const noPlace = () => null

function useLocalClock() {
  // Null until mounted: the server and the visitor's machine are in different
  // zones and would render different text, so the first paint stays neutral.
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const tick = () => setTime(formatter.format(new Date()))
    tick()
    // Align to the next minute, then tick once a minute — the readout only
    // shows hours and minutes, so a per-second interval would be waste.
    let interval: ReturnType<typeof setInterval>
    const timeout = setTimeout(() => {
      tick()
      interval = setInterval(tick, 60_000)
    }, (60 - new Date().getSeconds()) * 1000)

    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [])

  return time
}

/**
 * Country and temperature, both derived from the browser's own timezone.
 *
 * See lib/zone-places for why it is the zone and not an IP lookup. Either half
 * can come back empty — an unlisted zone, a blocked request — and the corner
 * simply prints what it has.
 */
function useLocalPlace() {
  const place = useSyncExternalStore(NEVER_CHANGES, readPlace, noPlace)
  const [temperature, setTemperature] = useState<number | null>(null)

  useEffect(() => {
    if (!place) return

    const controller = new AbortController()
    void fetchTemperature(place.lat, place.lon, controller.signal).then((value) => {
      if (!controller.signal.aborted) setTemperature(value)
    })
    return () => controller.abort()
  }, [place])

  return { cc: place?.cc ?? null, temperature }
}

/**
 * The footer carries its own bottom telemetry row (wireframe 1i), so the HUD's
 * bottom row would sit on top of a duplicate. Fade that row out once the footer
 * arrives and let the footer's take over.
 */
function useFooterInView() {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const footer = document.querySelector('footer')
    if (!footer) return

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  return inView
}

function pad(value: number): string {
  return String(Math.max(0, Math.round(value))).padStart(4, '0')
}

/**
 * The pointer's position in the middle of the bottom row.
 *
 * Written straight to the text node rather than held in state. The bus
 * republishes at most once a frame and only when the pointer has actually
 * moved, but "once a frame" through React is a re-render of this subtree per
 * frame for as long as the mouse is in motion — for four digits that change.
 *
 * Read from `pointerRaw`, the unsmoothed target, not from the eased `pointer`
 * the 3D layer uses: a lens that lags is an effect, a coordinate readout that
 * lags is wrong.
 */
function PointerCoords() {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const write = () => {
      const x = pointerRaw.x * window.innerWidth
      const y = pointerRaw.y * window.innerHeight
      node.textContent = `${pad(x)} X ${pad(y)} Y`
    }

    write()
    return subscribeToPointer(write)
  }, [])

  // Rendered with the same shape the client will write, so the server's markup
  // and the first client paint agree.
  return (
    <span ref={ref} className={styles.coords}>
      0000 X 0000 Y
    </span>
  )
}

/**
 * A turning globe — the supplied mark, redrawn as geometry.
 *
 * Traced off the artwork rather than embedded as a file, so it takes
 * currentColor, stays a hairline at any size, and — the reason that matters —
 * can be taken apart: the limb and the latitudes have to stay still while the
 * meridians move, and a flat image cannot do that.
 *
 * Its proportions are the artwork's own, measured: a 1.52:1 ellipse, meridians
 * at 0.39 and 0.76 of the radius either side of a straight central one, a
 * straight equator, and two latitudes that sit at 0.38 of the vertical radius
 * and lift very slightly where they meet the rim.
 *
 * The turn is the meridian pair scaled on X from 1 through 0 to -1, which is
 * what a sphere's lines of longitude actually do as it rotates. Done this way
 * rather than with a real 3D transform because at this size the perspective is
 * invisible and the cost is not, and because everything that does not move
 * stays outside the animated group and therefore perfectly crisp.
 */
function Globe() {
  return (
    <svg
      className={styles.globe}
      viewBox="0 0 30 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
    >
      <ellipse cx="15" cy="10" rx="14" ry="9.2" />
      {/* Equator straight and full width; the other two bow, as the artwork
          has them, and end on the rim rather than short of it. */}
      <path d="M 1 10 H 29 M 2.24 6.22 Q 15 6.78 27.76 6.22 M 2.24 13.78 Q 15 13.22 27.76 13.78" />
      {/* The 0° meridian has no width to lose, so it sits outside the group
          that sweeps and stays a clean vertical. */}
      <path d="M 15 0.8 V 19.2" />
      <g className={styles.meridians}>
        <ellipse cx="15" cy="10" rx="10.64" ry="9.2" />
        <ellipse cx="15" cy="10" rx="5.46" ry="9.2" />
      </g>
    </svg>
  )
}

export function Hud() {
  const time = useLocalClock()
  const { cc, temperature } = useLocalPlace()
  const zone = useSyncExternalStore(NEVER_CHANGES, readZone, noZone)
  const footerInView = useFooterInView()
  // Only the bottom row defers to the footer; the top-left wordmark is the
  // home link and stays visible on every screen.
  const handoff = footerInView ? styles.handedOff : ''

  return (
    <div className={styles.hud}>
      <div className={`${styles.corner} ${styles.topLeft}`}>
        <Link href="/" className={styles.wordmark} aria-label="Veerlabs — home">
          {/* priority: it is the first thing above the fold on every route, and
              a logo that pops in after the bar has drawn reads as a fault.
              alt is empty because the link already carries the name — a
              screen reader announcing "Veerlabs Veerlabs" is worse. */}
          <Image
            className={styles.mark}
            src="/logo/veerlabs-mark.png"
            alt=""
            width={325}
            height={160}
            /* Without this the optimizer sizes from the `width` prop and
               serves a 750px file for a 45px logo. Stated per breakpoint, it
               picks the smallest variant that still has retina to spare. */
            sizes="(max-width: 640px) 40px, 48px"
            priority
          />
          <span className={styles.wordmarkText} aria-hidden="true">
            Veerlabs
          </span>
        </Link>
      </div>

      <div className={`${styles.corner} ${styles.bottomLeft} ${handoff}`}>
        {/* Every part is null on the server and on the client's first paint
            alike, so no suppressHydrationWarning is needed — and each is
            independent, so a missing temperature does not take the clock with
            it. */}
        <span className={styles.zonePlace}>{[zone, cc].filter(Boolean).join(' ')}</span>
        <span className={styles.clockWeather}>
          {[time, temperature === null ? null : `${temperature}°C`].filter(Boolean).join(' ')}
        </span>
      </div>

      <div className={`${styles.corner} ${styles.bottomCenter} ${handoff}`}>
        <PointerCoords />
      </div>

      <div className={`${styles.corner} ${styles.bottomRight} ${handoff}`}>
        <Globe />
      </div>
    </div>
  )
}
