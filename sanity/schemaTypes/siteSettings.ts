import { defineField, defineType } from 'sanity'

/** Singleton — one document, enforced in sanity.config.ts's structure. */
export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  fields: [
    defineField({ name: 'bio', type: 'text', rows: 6 }),
    defineField({
      name: 'showreelUrl',
      type: 'url',
      title: 'Showreel URL (R2)',
      description: 'The hero reel. Compressed H.264 MP4 on Cloudflare R2.',
    }),
    defineField({ name: 'email', type: 'string' }),
    defineField({
      name: 'socials',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'label', type: 'string' },
            { name: 'url', type: 'url' },
          ],
          preview: { select: { title: 'label', subtitle: 'url' } },
        },
      ],
    }),
    defineField({ name: 'clientLogos', type: 'array', of: [{ type: 'image' }] }),
  ],
  preview: { prepare: () => ({ title: 'Site settings' }) },
})
