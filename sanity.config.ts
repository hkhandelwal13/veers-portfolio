'use client'

import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { apiVersion, dataset, studioProjectId } from '@/sanity/env'
import { schemaTypes } from '@/sanity/schemaTypes'
import { structure } from '@/sanity/structure'

/**
 * Studio config, mounted at /studio.
 *
 * Until NEXT_PUBLIC_SANITY_PROJECT_ID is set this falls back to a placeholder
 * id — the route still builds, it just can't reach a real dataset. See README
 * for the setup walkthrough.
 */
export default defineConfig({
  basePath: '/studio',
  projectId: studioProjectId,
  dataset,
  schema: { types: schemaTypes },
  plugins: [structureTool({ structure }), visionTool({ defaultApiVersion: apiVersion })],
})
