/**
 * Embedded Sanity Studio at /studio.
 *
 * Needs NEXT_PUBLIC_SANITY_PROJECT_ID to reach a real dataset — see README
 * "Accounts you need". The route builds without it; it just won't log in.
 */
import { NextStudio } from 'next-sanity/studio'
import config from '@/sanity.config'

export const dynamic = 'force-static'

export { metadata, viewport } from 'next-sanity/studio'

export default function StudioPage() {
  return <NextStudio config={config} />
}
