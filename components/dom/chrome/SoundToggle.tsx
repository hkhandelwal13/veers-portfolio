'use client'

import { useSyncExternalStore } from 'react'
import {
  getAudioState,
  getServerAudioState,
  subscribeToAudio,
  toggleAudio,
} from '@/lib/site-audio'
import styles from './SoundToggle.module.css'

/**
 * Sound on/off, in the nav bar.
 *
 * Sits outside the link list rather than in it, so it survives the collapse
 * into the menu button: a control the visitor may want the moment the music
 * starts cannot be two taps deep behind a hamburger. Below the desktop
 * breakpoint the word goes and the bars stay.
 *
 * The bars are the state, and they are honest about all three of it: they move
 * while it is playing, stand still while a video has it ducked, and drop to a
 * flat line when it is off. Like ThemeToggle, it carries no colour of its own —
 * it inherits the row it renders in.
 */
export function SoundToggle() {
  const audio = useSyncExternalStore(subscribeToAudio, getAudioState, getServerAudioState)

  const label = audio.enabled ? 'on' : 'off'
  const detail = audio.enabled && !audio.playing ? ' (waiting)' : ''

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleAudio}
      aria-pressed={audio.enabled}
      aria-label={`Sound ${label}${detail}. Keyboard shortcut S.`}
    >
      <span className={styles.label} aria-hidden="true">
        Sound[S]
      </span>
      <span
        className={styles.bars}
        data-on={audio.enabled || undefined}
        data-live={audio.playing || undefined}
        aria-hidden="true"
      >
        <span />
        <span />
        <span />
        <span />
      </span>
    </button>
  )
}
