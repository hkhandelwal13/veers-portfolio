'use client'

import { useEffect, useState } from 'react'
import { fetchTemperature } from '@/lib/weather'
import { getTimeZone, getZonePlace } from '@/lib/zone-places'
import styles from './Hero.module.css'

/** Mobile-only hero telemetry, matching the reference's quiet lower-left readout. */
export function HeroTelemetry() {
  const [time, setTime] = useState<string | null>(null)
  const [temperature, setTemperature] = useState<number | null>(null)

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const tick = () => setTime(formatter.format(new Date()))
    tick()

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

  useEffect(() => {
    const place = getZonePlace(getTimeZone())
    if (!place) return

    const controller = new AbortController()
    void fetchTemperature(place.lat, place.lon, controller.signal).then((value) => {
      if (!controller.signal.aborted) setTemperature(value)
    })
    return () => controller.abort()
  }, [])

  return (
    <div className={styles.mobileTelemetry} aria-label="Local time and temperature">
      {time && <span>{time}</span>}
      {temperature !== null && <span>{temperature}°C</span>}
    </div>
  )
}
