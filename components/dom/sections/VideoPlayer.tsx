'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './ProjectDetail.module.css'

/**
 * The project page's player.
 *
 * Our own chrome over a plain `<video>` — no third-party player (CLAUDE.md §3).
 * The file is on R2 and served as-is, so there is no manifest to parse and no
 * rendition to pick; what a library would add here is a bundle, a skin to
 * override and a second set of keyboard shortcuts to reconcile with ours.
 *
 * Three decisions worth keeping:
 *
 *   - `preload="metadata"` fetches the index and nothing else, so arriving on
 *     the page costs a few kilobytes and a duration rather than the film.
 *   - the scrubber is a real `<input type="range">` under the drawn bar, so
 *     dragging, arrow keys, Home/End and screen readers all work without being
 *     re-implemented on a div.
 *   - the controls fade only while it is playing *and* the pointer is away —
 *     paused, or under the pointer, they stay. A touch device has no pointer
 *     to leave, so there they simply stay.
 */

function timecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const whole = Math.floor(seconds)
  const mm = Math.floor(whole / 60)
  const ss = whole % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export function VideoPlayer({
  src,
  poster,
  title,
}: {
  src: string
  poster: string
  title: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [pointerNear, setPointerNear] = useState(false)

  const toggle = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play().catch(() => setPlaying(false))
    else video.pause()
  }, [])

  const seek = useCallback((value: number) => {
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration)) return
    video.currentTime = (value / 1000) * video.duration
    setCurrent(video.currentTime)
  }, [])

  // The element is the source of truth for play state, not this component:
  // it can pause itself — end of file, the OS taking the audio session, a
  // media key — and state that only tracks our own clicks drifts out of step.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime = () => setCurrent(video.currentTime)
    const onMeta = () => setDuration(video.duration)
    const onVolume = () => setMuted(video.muted)

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('volumechange', onVolume)
    // Metadata can already be in by the time this runs.
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) setDuration(video.duration)

    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('volumechange', onVolume)
    }
  }, [])

  const fullscreen = () => {
    const video = videoRef.current
    if (!video) return
    const box = video.parentElement
    if (document.fullscreenElement) void document.exitFullscreen()
    else void box?.requestFullscreen?.().catch(() => {})
  }

  const progress = duration > 0 ? (current / duration) * 1000 : 0
  const chromeHidden = playing && !pointerNear

  return (
    <div
      className={styles.player}
      onPointerEnter={() => setPointerNear(true)}
      onPointerLeave={() => setPointerNear(false)}
    >
      <video
        ref={videoRef}
        className={styles.video}
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        onClick={toggle}
      />

      {!playing && (
        <button
          type="button"
          className={styles.playButton}
          onClick={toggle}
          aria-label={`Play ${title}`}
        >
          <span className={styles.playGlyph} aria-hidden="true" />
        </button>
      )}

      <div className={styles.controls} data-hidden={chromeHidden || undefined}>
        <div className={styles.scrubber}>
          <div className={styles.progress} style={{ width: `${progress / 10}%` }}>
            <span className={styles.knob} />
          </div>
          <input
            className={styles.seek}
            type="range"
            min={0}
            max={1000}
            step={1}
            value={progress}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label={`Seek ${title}`}
            aria-valuetext={`${timecode(current)} of ${timecode(duration)}`}
          />
        </div>

        <div className={styles.controlRow}>
          <div className={styles.controlLeft}>
            <button
              type="button"
              className={styles.transport}
              onClick={toggle}
              aria-label={playing ? `Pause ${title}` : `Play ${title}`}
            >
              {playing ? (
                <span className={styles.pauseGlyph} aria-hidden="true">
                  <span />
                  <span />
                </span>
              ) : (
                <span className={styles.smallPlayGlyph} aria-hidden="true" />
              )}
            </button>
            <span className={styles.time}>
              {timecode(current)} / {timecode(duration)}
            </span>
          </div>

          <div className={styles.controlRight}>
            <button
              type="button"
              onClick={() => {
                const video = videoRef.current
                if (video) video.muted = !video.muted
              }}
              aria-pressed={muted}
            >
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button type="button" onClick={fullscreen}>
              ⤢ Fullscreen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
