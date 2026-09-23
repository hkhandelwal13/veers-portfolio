'use client'

import { useSyncExternalStore } from 'react'
import {
  getAudioState,
  getServerAudioState,
  subscribeToAudio,
  toggleAudio,
} from '@/lib/site-audio'
import styles from './SoundToggle.module.css'

/** One accessible sound control on desktop and mobile. */
export function SoundToggle() {
  const audio = useSyncExternalStore(subscribeToAudio, getAudioState, getServerAudioState)

  const label = audio.enabled ? 'on' : 'off'
  const detail = audio.enabled && !audio.playing ? ' (waiting)' : ''

  return (
    <button
      type="button"
      data-sound-toggle
      className={styles.toggle}
      onClick={toggleAudio}
      aria-pressed={audio.enabled}
      aria-label={`Sound ${label}${detail}. Keyboard shortcut S.`}
    >
      <span className={styles.label} aria-hidden="true">
        Sound[S]
      </span>
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        {audio.enabled ? (
          <>
            <path d="M15 8a6 6 0 0 1 0 8" />
            <path d="M18 5a10 10 0 0 1 0 14" />
          </>
        ) : <path d="m16 9 5 6m0-6-5 6" />}
      </svg>
    </button>
  )
}
