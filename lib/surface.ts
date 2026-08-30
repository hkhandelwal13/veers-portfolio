/**
 * Which surface the page is painting — light or dark.
 *
 * The glass tints differently per theme (Beer-Lambert absorption on light,
 * Hard-Light on dark), and that choice is needed inside useFrame, where reading
 * a DOM attribute every frame would be wasteful. <SurfaceTheme> writes here; the
 * WebGL layer reads.
 */

let dark = false

export function setSurfaceDark(value: boolean) {
  dark = value
}

export function isSurfaceDark(): boolean {
  return dark
}
