'use client'

import { useSyncExternalStore } from 'react'
import { getTargetIds, subscribeToTargets } from '@/lib/rect-sampler'
import { CARD_TARGET_PREFIX } from './card-target-id'
import { CardMirror } from './CardMirror'

/**
 * Renders one mirror per registered card target.
 *
 * Subscribes to *registration* changes only — mounting and unmounting cards —
 * never to rect updates, which are silent by design. So this re-renders when
 * the route changes the set of cards, and not once while scrolling.
 */

/** Joined so the snapshot is a primitive and React can bail out on equality. */
function getCardTargetKey() {
  return getTargetIds()
    .filter((id) => id.startsWith(CARD_TARGET_PREFIX))
    .sort()
    .join('|')
}

const EMPTY = ''

export function CardMirrors() {
  const key = useSyncExternalStore(subscribeToTargets, getCardTargetKey, () => EMPTY)
  const ids = key === '' ? [] : key.split('|')

  return (
    <>
      {ids.map((id) => (
        <CardMirror key={id} targetId={id} />
      ))}
    </>
  )
}
