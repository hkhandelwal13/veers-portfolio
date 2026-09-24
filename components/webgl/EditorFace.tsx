'use client'

import { CardMirror } from './CardMirror'

/** Shares the grid's develop and velocity-curl shader on every screen size. */
export function EditorFace() {
  return <CardMirror targetId="editor-face" posterUrl="/editor-portrait.jpg" />
}
