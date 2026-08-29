import imageUrlBuilder from '@sanity/image-url'
import type { Image } from 'sanity'
import { dataset, isConfigured, projectId } from '@/sanity/env'

const builder = isConfigured ? imageUrlBuilder({ projectId, dataset }) : null

/** Returns null when Sanity isn't configured or the image is missing. */
export function urlFor(source: Image | undefined | null) {
  if (!builder || !source) return null
  return builder.image(source)
}
