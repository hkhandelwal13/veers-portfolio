import type { StructureResolver } from 'sanity/structure'

/** siteSettings is a singleton, so it gets a fixed document node, not a list. */
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Site settings')
        .id('siteSettings')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
      S.divider(),
      S.documentTypeListItem('project').title('Projects'),
    ])
