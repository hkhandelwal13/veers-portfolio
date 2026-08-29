import type { Image } from 'sanity'

export type Credit = { role?: string; name?: string }

export type Project = {
  _id: string
  title: string
  slug: string
  client?: string
  role?: string
  year?: number
  categories?: string[]
  description?: string
  credits?: Credit[]
  poster?: Image
  /** Short muted loop on R2 — card hover only. */
  previewUrl?: string
  /** Full compressed showreel on R2 — project page only. */
  videoUrl?: string
  order?: number
  featured?: boolean
}

export type SocialLink = { label?: string; url?: string }

export type SiteSettings = {
  bio?: string
  showreelUrl?: string
  email?: string
  socials?: SocialLink[]
  clientLogos?: Image[]
}
