'use client'

import { useSyncExternalStore } from 'react'
import { Scramble } from '@/components/dom/Scramble'
import { WebGLTarget } from '@/components/dom/WebGLTarget'
import {
  getFinaleProgress,
  getHeadlineStep,
  isManifestoUp,
  isTunnelBehind,
} from '@/lib/finale-progress'
import { subscribeToScroll } from '@/lib/scroll-bus'
import styles from './Finale.module.css'

/**
 * The closing sequence — scrolled, not played.
 *
 * A tall section with a stage pinned inside it, so travelling through the
 * finale is the section moving past a stage that holds still. Everything is a
 * function of that travel (lib/finale-progress), which is what lets it run
 * backwards when you scroll up.
 *
 * This half is only the copy. The arrow, the rays and the rings are WebGL, and
 * the section's job on their behalf is to be a rect tall enough to scrub
 * against — see FinaleArrow.
 *
 * The DOM copy sits *over* the canvas, so the headlines stay crisp type rather
 * than becoming pixels in the warp.
 */

const HEADLINES = ['Every frame earns its cut', 'Story before spectacle', 'Cut with intent']

/** Placed around the burst rather than stacked, so the rays run between them. */
const MANIFESTO = [
  { text: 'Cut for story, not for show.', className: 'topLeft' },
  { text: 'Pace is a feeling, not a setting.', className: 'topRight' },
  { text: 'Colour, sound and silence do the talking.', className: 'bottomLeft' },
  { text: 'Ship the reel. Sweat the frame.', className: 'bottomRight' },
] as const

/**
 * Re-renders only when the beat changes, not on every scrolled pixel.
 *
 * getSnapshot returns a small integer, so React bails out of the render on
 * every frame that lands inside the same beat — which is nearly all of them.
 * Two facts are packed into it, the beat and whether the tunnel is behind the
 * copy, because useSyncExternalStore compares snapshots by identity and a
 * fresh object every frame would defeat the whole arrangement.
 */
function useFinaleState() {
  const packed = useSyncExternalStore(
    subscribeToScroll,
    () => {
      const t = getFinaleProgress()
      const beat = isManifestoUp(t) ? 3 : getHeadlineStep(t)
      return beat * 2 + (isTunnelBehind(t) ? 1 : 0)
    },
    () => -2,
  )

  return { beat: Math.floor(packed / 2), onTunnel: packed % 2 === 1 }
}

export function Finale() {
  const { beat, onTunnel } = useFinaleState()

  return (
    <section className={styles.section} aria-labelledby="finale-heading">
      {/* The rect the sequence scrubs against. */}
      <WebGLTarget targetId="finale-stage" className={styles.stageTarget} aria-hidden="true" />

      <h2 id="finale-heading" className="visually-hidden">
        What the work is for
      </h2>

      <div className={styles.stage} data-ground={onTunnel ? 'tunnel' : 'page'}>
        {/* The rect the arrow is seated on. Inside the sticky stage, not on
            the section, so the arrow rises into frame as the work grid leaves
            and is carried back up over the closing screen on the way out. */}
        <WebGLTarget targetId="finale-arrow" className={styles.arrowSlot} aria-hidden="true" />

        {beat >= 0 && beat < 3 && (
          // Keyed by beat so the decode replays on each change: the component
          // starts its scramble on mount, and a new key is a new mount.
          <p key={beat} className={styles.headline}>
            <Scramble text={HEADLINES[beat]} />
          </p>
        )}

        {beat === 3 && (
          <div className={styles.manifesto}>
            {MANIFESTO.map((line, i) => (
              <p key={line.text} className={`${styles.line} ${styles[line.className]}`}>
                <span style={{ animationDelay: `${i * 140}ms` }} className={styles.lineInner}>
                  {line.text}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
