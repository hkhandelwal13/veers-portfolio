/**
 * Sanity environment.
 *
 * Nothing here throws when the vars are missing: the site has to run before the
 * client has created a Sanity project (Phase 1 is scaffold-only). `isConfigured`
 * is the switch — data helpers return null when it's false and pages fall back
 * to placeholder content.
 */
export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? ''
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
export const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-08-29'

export const isConfigured = projectId.length > 0

/** Studio needs a syntactically valid id even when unconfigured. */
export const studioProjectId = isConfigured ? projectId : 'placeholder'
