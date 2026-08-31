/**
 * Which surface the WebGL layer is drawing against — light or dark.
 *
 * Two things can make it dark, and they are independent: the site theme, and a
 * page that paints dark regardless (the project detail screen does, even in the
 * light theme). Either one is enough.
 *
 * The glass tints differently per surface — Beer-Lambert absorption on light,
 * Hard Light on dark — and that choice is needed inside useFrame, where reading
 * a DOM attribute every frame would be wasteful.
 */

let themeDark = false
let pageDark = false

/** Set by the theme store. */
export function setThemeDark(value: boolean) {
  themeDark = value
}

/** Set by <SurfaceTheme>, for pages that paint dark whatever the theme. */
export function setPageSurfaceDark(value: boolean) {
  pageDark = value
}

export function isSurfaceDark(): boolean {
  return themeDark || pageDark
}

/**
 * Only the page's own darkness, ignoring the theme.
 *
 * The refraction pass needs this one separately: in the dark theme the page
 * ground is already --bg, so clearing to the --dark-bg treatment would be a
 * shade off. Only a genuinely dark *page* overlays that treatment.
 */
export function isPageSurfaceDark(): boolean {
  return pageDark
}
