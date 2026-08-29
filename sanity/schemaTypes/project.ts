import { defineField, defineType } from 'sanity'

/**
 * A single piece of work. Video lives on Cloudflare R2 (CLAUDE.md §4) — Sanity
 * only ever stores the URLs, never the files, which is what keeps this on the
 * free tier.
 */
export const project = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', validation: (r) => r.required() }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({ name: 'client', type: 'string' }),
    defineField({ name: 'role', type: 'string', description: 'e.g. Editor, Colourist' }),
    defineField({ name: 'year', type: 'number' }),
    defineField({
      name: 'categories',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: ['Commercial', 'Music Video', 'Documentary', 'Short Film', 'Motion Graphics'],
      },
    }),
    defineField({ name: 'description', type: 'text', rows: 4 }),
    defineField({
      name: 'credits',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'role', type: 'string' },
            { name: 'name', type: 'string' },
          ],
          preview: { select: { title: 'name', subtitle: 'role' } },
        },
      ],
    }),
    defineField({
      name: 'poster',
      type: 'image',
      options: { hotspot: true },
      description: 'Card thumbnail and video poster frame. Set manually — no auto-poster off R2.',
    }),
    defineField({
      name: 'previewUrl',
      type: 'url',
      title: 'Preview loop URL (R2)',
      description: 'Short (2–4s), muted, small. Played on card hover / in view — never the full file.',
    }),
    defineField({
      name: 'videoUrl',
      type: 'url',
      title: 'Full video URL (R2)',
      description: 'Compressed H.264 MP4 for the project page player.',
    }),
    defineField({ name: 'order', type: 'number', description: 'Lower sorts first in the grid.' }),
    defineField({ name: 'featured', type: 'boolean', initialValue: false }),
  ],
  orderings: [
    { title: 'Grid order', name: 'order', by: [{ field: 'order', direction: 'asc' }] },
    { title: 'Newest', name: 'year', by: [{ field: 'year', direction: 'desc' }] },
  ],
  preview: {
    select: { title: 'title', subtitle: 'client', media: 'poster' },
  },
})
