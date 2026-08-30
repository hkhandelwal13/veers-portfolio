'use client'

import { useEffect, useRef } from 'react'
import { registerTarget } from '@/lib/rect-sampler'

/**
 * A transparent DOM element whose rectangle WebGL mirrors.
 *
 * CSS positions and sizes it; the sampler reads its getBoundingClientRect() and
 * the canvas draws over the result. Nothing renders inside it — the box exists
 * purely so the layout engine, not the 3D code, decides where things go
 * (CLAUDE.md §2).
 *
 * Imports nothing from three: this sits on the DOM side of the bridge, and the
 * rect cache is a plain module.
 */
export function WebGLTarget({
  targetId,
  className,
  style,
  children,
  as: Tag = 'div',
  ...rest
}: {
  /** Stable key the WebGL side looks the rect up by. */
  targetId: string
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
  as?: 'div' | 'figure' | 'span'
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    return registerTarget(targetId, element)
  }, [targetId])

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      data-webgl={targetId}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  )
}
