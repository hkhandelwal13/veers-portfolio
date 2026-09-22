/**
 * The site's background track.
 *
 * Module-level rather than React state, for the same reason the scroll, pointer
 * and card-clip buses are: the things that command it are scattered across the
 * tree and none of them should have to re-render to be heard. The nav's toggle
 * writes it, the scroll bus arms it, and the project page's player ducks it.
 *
 * Two gates, both of which must be open before a note plays:
 *
 *   enabled  on by default, and off only because the visitor said so
 *   ducks    nothing else is claiming the room (a video that is playing)
 *
 * The choice is deliberately NOT remembered. Every load starts from the
 * default, which is what "reset on refresh" means: turning it off is a
 * decision about this visit, not a setting.
 *
 * What no amount of wanting can change is that every browser refuses `play()`
 * on an unmuted element until the page has had a real user gesture. So a
 * refusal is not an error here: it parks the track and starts it at the next
 * genuine click, key or tap. The toggle is itself a gesture, so turning it on
 * by hand always works.
 */

export type AudioState = Readonly<{
  /** The visitor's preference. What the toggle shows. */
  enabled: boolean
  /** Whether a note is actually coming out right now. */
  playing: boolean
  /** True while the track is on but held down by a video. */
  ducked: boolean
  /** True while the browser has refused to start it without a gesture. */
  waitingForGesture: boolean
}>

const SRC = '/audio/veerlabs-theme.mp3'

/**
 * Well under the track's own level: it plays under the whole site, and a
 * background score that competes with a showreel's dialogue is one the visitor
 * turns off rather than down.
 */
const VOLUME = 0.32
/** Seconds to fade across, so nothing ever starts or stops on a hard edge. */
const FADE_SECONDS = 0.6

let element: HTMLAudioElement | null = null
let enabled = true
let waitingForGesture = false
const ducks = new Set<string>()

let fade: number | null = null
let gestureCleanup: (() => void) | null = null
/**
 * Bumped by every reconcile. A `play()` that resolves after a newer decision
 * has been taken must not act on it.
 *
 * This is the whole of the bug that made the toggle look broken on a phone. A
 * tap is a pointerdown and then a click: the pointerdown satisfied the parked
 * gesture listener and started a play(), the click turned the sound off and
 * paused it, and then the play() promise resolved and ramped the volume
 * straight back up. On a desktop the first click of a visit is rarely the
 * toggle, so it almost never showed; on a phone the toggle is exactly what
 * people reach for first.
 */
let generation = 0

const listeners = new Set<() => void>()
let snapshot: AudioState = Object.freeze({
  enabled: true,
  playing: false,
  ducked: false,
  waitingForGesture: false,
})

const SERVER_STATE: AudioState = Object.freeze({
  enabled: true,
  playing: false,
  ducked: false,
  waitingForGesture: false,
})

function publish() {
  const playing = element ? !element.paused : false
  if (
    snapshot.enabled === enabled &&
    snapshot.playing === playing &&
    snapshot.ducked === (ducks.size > 0) &&
    snapshot.waitingForGesture === waitingForGesture
  ) {
    return
  }
  snapshot = Object.freeze({
    enabled,
    playing,
    ducked: ducks.size > 0,
    waitingForGesture,
  })
  for (const listener of listeners) listener()
}

function ensureElement(): HTMLAudioElement | null {
  if (element) return element
  if (typeof document === 'undefined') return null

  element = new Audio()
  element.src = SRC
  element.loop = true
  // Metadata only until it is actually wanted: the file is over a megabyte,
  // and a visit that bounces before the browser grants a gesture should not
  // have paid for it.
  element.preload = 'none'
  element.volume = 0
  // Both events fire from outside our own calls too — a media key, the OS
  // taking the audio session — so the readout follows the element rather than
  // our intentions.
  element.addEventListener('play', publish)
  element.addEventListener('pause', publish)
  return element
}

/** Ramps to a target and, at zero, pauses at the end of the ramp. */
function rampTo(target: number) {
  const audio = element
  if (!audio) return
  if (fade !== null) {
    clearInterval(fade)
    fade = null
  }

  const STEP_MS = 40
  const step = (STEP_MS / 1000 / FADE_SECONDS) * Math.max(VOLUME, 0.01)

  fade = window.setInterval(() => {
    const next =
      audio.volume < target
        ? Math.min(target, audio.volume + step)
        : Math.max(target, audio.volume - step)
    audio.volume = next

    if (Math.abs(next - target) > 1e-3) return
    if (fade !== null) {
      clearInterval(fade)
      fade = null
    }
    if (target === 0 && !audio.paused) {
      audio.pause()
      publish()
    }
  }, STEP_MS)
}

/**
 * Starts the track at the next click, key or tap.
 *
 * Installed only once a `play()` has actually been refused, so a browser that
 * lets the page open with sound never pays for these listeners at all.
 */
function waitForGesture() {
  if (gestureCleanup) return
  waitingForGesture = true

  const start = () => {
    gestureCleanup?.()
    reconcile()
  }
  const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchend']
  for (const name of events) window.addEventListener(name, start, { once: true, passive: true })

  gestureCleanup = () => {
    for (const name of events) window.removeEventListener(name, start)
    gestureCleanup = null
    waitingForGesture = false
  }
  publish()
}

function reconcile() {
  const audio = ensureElement()
  if (!audio) return

  const mine = ++generation
  const wanted = enabled && ducks.size === 0

  if (!wanted) {
    gestureCleanup?.()
    if (!audio.paused) rampTo(0)
    publish()
    return
  }

  if (!audio.paused) {
    rampTo(VOLUME)
    publish()
    return
  }

  // preload="none" means nothing has been fetched yet, and play() alone is not
  // a reliable trigger for the resource selection algorithm — the same lesson
  // the card previews taught (components/webgl/card-media).
  if (audio.networkState === HTMLMediaElement.NETWORK_EMPTY) audio.load()

  void audio
    .play()
    .then(() => {
      // Stale: something was decided while this was in flight. Undo it rather
      // than ramping up over the top of a newer intention.
      if (mine !== generation) {
        if (!(enabled && ducks.size === 0)) audio.pause()
        return
      }
      gestureCleanup?.()
      rampTo(VOLUME)
      publish()
    })
    .catch(() => {
      if (mine !== generation) return
      // Refused for want of a gesture. Not a failure — park it.
      waitForGesture()
    })
}

/**
 * The visitor's own choice, from the toggle.
 *
 * Not written to storage: the default is on, and every load starts there.
 */
export function setAudioEnabled(value: boolean) {
  if (enabled === value) return
  enabled = value
  reconcile()
}

export function toggleAudio() {
  setAudioEnabled(!enabled)
}

/**
 * Tries to start the track.
 *
 * Called once on mount and again on the first scroll — not because a scroll is
 * a gesture (it is not, in any engine) but because by then the page may have
 * accrued enough media engagement for the browser to relent, and the attempt
 * costs one function call.
 */
export function startAudio() {
  reconcile()
}

export function isAudioPlaying(): boolean {
  return element !== null && !element.paused
}

/**
 * Holds the track down while something else is playing.
 *
 * Keyed, and a set rather than a counter, so the same source releasing twice —
 * a video firing `pause` and then `ended` — cannot leave the music off.
 */
export function duckAudio(id: string) {
  if (ducks.has(id)) return
  ducks.add(id)
  reconcile()
}

export function unduckAudio(id: string) {
  if (!ducks.delete(id)) return
  reconcile()
}

export function subscribeToAudio(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getAudioState(): AudioState {
  return snapshot
}

export function getServerAudioState(): AudioState {
  return SERVER_STATE
}

/**
 * Dev-only readout.
 *
 * The element is created with `new Audio()` and never enters the document, so
 * no DOM query can see it — the only honest way to check that a scroll started
 * the track is to ask the module. Stripped from production builds by the
 * constant condition.
 */
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __siteAudio?: () => unknown }).__siteAudio = () => ({
    enabled,
    waitingForGesture,
    ducks: [...ducks],
    exists: element !== null,
    paused: element ? element.paused : null,
    volume: element ? +element.volume.toFixed(2) : null,
    readyState: element ? element.readyState : null,
    networkState: element ? element.networkState : null,
    currentTime: element ? +element.currentTime.toFixed(2) : null,
    error: element?.error ? `${element.error.code}: ${element.error.message}` : null,
  })
}

/**
 * The "S" shortcut the nav's Sound[S] label advertises.
 *
 * Registered once, from <SiteAudio>, rather than by the button — the same
 * reasoning as the theme's A: one listener, however many controls render it.
 */
export function attachAudioShortcut() {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 's' && event.key !== 'S') return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (event.repeat || event.defaultPrevented) return

    // Never steal the key from someone typing.
    const target = event.target as HTMLElement | null
    if (target?.isContentEditable) return
    const tag = target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

    toggleAudio()
  }

  document.addEventListener('keydown', onKeyDown)
  return () => document.removeEventListener('keydown', onKeyDown)
}

/** Test seam. */
export function resetSiteAudio() {
  gestureCleanup?.()
  if (fade !== null) clearInterval(fade)
  fade = null
  element?.pause()
  element = null
  enabled = true
  waitingForGesture = false
  ducks.clear()
  snapshot = SERVER_STATE
}
