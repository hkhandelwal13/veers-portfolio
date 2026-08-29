'use client'

import dynamic from 'next/dynamic'

/**
 * Client-only mount point for the WebGL stage (CLAUDE.md §3).
 *
 * ssr: false is only legal inside a Client Component, so this thin wrapper
 * exists to hold the dynamic import — the server layout renders <WebGLCanvas />
 * and never pulls three.js into the server bundle.
 */
const Scene = dynamic(() => import('./Scene'), { ssr: false })

export function WebGLCanvas() {
  return (
    <div className="webgl-stage" aria-hidden="true">
      <Scene />
    </div>
  )
}
