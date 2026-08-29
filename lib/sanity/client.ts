import { createClient, type SanityClient } from 'next-sanity'
import { apiVersion, dataset, isConfigured, projectId } from '@/sanity/env'

/**
 * Read-only Sanity client, or null when the project isn't configured yet.
 *
 * Callers must handle null — that's what lets the whole site run against
 * placeholder content before the client has a Sanity account.
 */
export const client: SanityClient | null = isConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      // CDN for published content; Studio previews bypass it.
      useCdn: true,
      perspective: 'published',
    })
  : null
