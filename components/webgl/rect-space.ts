import type { PerspectiveCamera, Vector4 } from 'three'
import type { TargetRect } from '@/lib/rect-sampler'

/**
 * The two coordinate conversions this phase needs.
 *
 * DOM rects arrive from getBoundingClientRect(): CSS pixels, origin top-left,
 * Y growing downward. Neither destination uses that convention, so both
 * conversions below flip Y — this is the single place that happens.
 */

/**
 * Rect → normalized screen space for a `uRect` uniform (xy = origin, zw = size).
 *
 * Shader UV starts bottom-left, so the origin becomes the rect's BOTTOM edge
 * measured up from the bottom of the viewport. Getting this wrong mirrors every
 * card about the horizontal centre of the screen, which looks plausible at the
 * centre and obviously wrong at the top and bottom.
 */
export function rectToUniform(
  rect: TargetRect,
  viewportWidth: number,
  viewportHeight: number,
  out: Vector4,
): Vector4 {
  const w = viewportWidth || 1
  const h = viewportHeight || 1

  return out.set(
    rect.x / w,
    1 - (rect.y + rect.height) / h,
    rect.width / w,
    rect.height / h,
  )
}

export type WorldSeat = {
  /** World-space centre of the rect on the camera's focal plane. */
  x: number
  y: number
  /** World units per CSS pixel at that plane. */
  unitsPerPixel: number
}

/**
 * Rect → world space on the plane z = `planeZ`, for a perspective camera that
 * looks straight down -Z.
 *
 * Everything follows from the visible height at that distance: once we know how
 * many world units one CSS pixel is worth, a rect centre is just an offset from
 * the viewport centre, with Y negated because screen Y grows downward.
 *
 * The camera's own position is included rather than assumed to be at the
 * origin, so the seat stays correct if the camera is ever animated.
 */
export function rectToWorld(
  rect: TargetRect,
  camera: PerspectiveCamera,
  viewportWidth: number,
  viewportHeight: number,
  planeZ = 0,
): WorldSeat {
  const distance = Math.abs(camera.position.z - planeZ)
  const visibleHeight = 2 * distance * Math.tan((camera.fov * Math.PI) / 360)
  const unitsPerPixel = visibleHeight / (viewportHeight || 1)

  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2

  return {
    x: camera.position.x + (centerX - viewportWidth / 2) * unitsPerPixel,
    y: camera.position.y - (centerY - viewportHeight / 2) * unitsPerPixel,
    unitsPerPixel,
  }
}

/** True when the rect is usable and close enough to the viewport to draw. */
export function isRectVisible(rect: TargetRect, viewportHeight: number, margin = 200) {
  if (!rect.valid) return false
  return rect.y < viewportHeight + margin && rect.y + rect.height > -margin
}
