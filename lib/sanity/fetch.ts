import { client } from './client'
import { projectBySlugQuery, projectSlugsQuery, projectsQuery, siteSettingsQuery } from './queries'
import type { Project, SiteSettings } from './types'

/**
 * Data helpers.
 *
 * Every one returns an empty result rather than throwing when Sanity isn't
 * configured, so pages render placeholder content instead of 500ing during
 * Phases 1–3.
 */

const revalidate = 60

export async function getProjects(): Promise<Project[]> {
  if (!client) return []
  return client.fetch<Project[]>(projectsQuery, {}, { next: { revalidate } })
}

export async function getProject(slug: string): Promise<Project | null> {
  if (!client) return null
  return client.fetch<Project | null>(projectBySlugQuery, { slug }, { next: { revalidate } })
}

export async function getProjectSlugs(): Promise<string[]> {
  if (!client) return []
  return client.fetch<string[]>(projectSlugsQuery, {}, { next: { revalidate } })
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  if (!client) return null
  return client.fetch<SiteSettings | null>(siteSettingsQuery, {}, { next: { revalidate } })
}
