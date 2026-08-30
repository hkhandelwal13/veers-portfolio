/**
 * Key prefix for project-card rect targets.
 *
 * Kept in its own module with no imports so the DOM side can use it without
 * pulling the WebGL runtime into the main bundle.
 */
export const CARD_TARGET_PREFIX = 'card:'

export function cardTargetId(slug: string) {
  return `${CARD_TARGET_PREFIX}${slug}`
}
