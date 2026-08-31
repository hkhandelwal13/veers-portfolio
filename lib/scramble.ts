/**
 * Text decode — every character cycles through capitals, digits and symbols
 * before settling into the real copy, like a CLI resolving a message.
 *
 * One ticker for the whole site, not one per element. A dozen labels each
 * running their own interval is a dozen timers waking the main thread out of
 * phase; a single 40ms tick drives all of them and stops itself the moment the
 * last one finishes.
 *
 * Elements subscribe when they enter the viewport and unsubscribe as soon as
 * they are done, so the cost is bounded by what is on screen mid-animation
 * rather than by how much text the page contains.
 */

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+-<>/\\'
const TICK_MS = 40

/** How far apart the first and last character settle. */
const SPREAD_MS = 420
/** Minimum ticks a character spends scrambled, so nothing resolves instantly. */
const MIN_TICKS = 2
/** Random tail on each character's settle, to break up the sweep. */
const JITTER_TICKS = 4

type Job = {
  element: HTMLElement
  text: string
  /** Tick index at which each character stops scrambling. */
  settleAt: number[]
  tick: number
}

const jobs = new Set<Job>()
let handle: ReturnType<typeof setInterval> | null = null

function randomChar() {
  return CHARSET[(Math.random() * CHARSET.length) | 0]
}

function tick() {
  for (const job of jobs) {
    job.tick += 1

    let out = ''
    let settled = true

    for (let i = 0; i < job.text.length; i++) {
      const char = job.text[i]
      // Whitespace never scrambles: the decode should read as characters
      // resolving in place, and shuffling the gaps turns it into noise.
      if (char === ' ' || char === '\n' || char === '\t') {
        out += char
      } else if (job.tick >= job.settleAt[i]) {
        out += char
      } else {
        out += randomChar()
        settled = false
      }
    }

    job.element.textContent = out

    if (settled) {
      job.element.textContent = job.text
      jobs.delete(job)
    }
  }

  if (jobs.size === 0 && handle !== null) {
    clearInterval(handle)
    handle = null
  }
}

/**
 * Starts decoding `element` into `text`. Returns a cancel that restores the
 * final text — a component unmounting mid-decode must not leave garbage behind
 * or keep the ticker alive.
 */
export function scramble(element: HTMLElement, text: string) {
  const spreadTicks = Math.max(1, Math.round(SPREAD_MS / TICK_MS))
  const lastIndex = Math.max(text.length - 1, 1)

  const settleAt = new Array<number>(text.length)
  for (let i = 0; i < text.length; i++) {
    settleAt[i] =
      MIN_TICKS +
      Math.round((i / lastIndex) * spreadTicks) +
      ((Math.random() * JITTER_TICKS) | 0)
  }

  const job: Job = { element, text, settleAt, tick: 0 }
  jobs.add(job)

  handle ??= setInterval(tick, TICK_MS)

  return () => {
    if (jobs.delete(job)) element.textContent = text
    if (jobs.size === 0 && handle !== null) {
      clearInterval(handle)
      handle = null
    }
  }
}
