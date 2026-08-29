import { groq } from 'next-sanity'

const projectFields = groq`
  _id,
  title,
  "slug": slug.current,
  client,
  role,
  year,
  categories,
  description,
  credits[]{ role, name },
  poster,
  previewUrl,
  videoUrl,
  order,
  featured
`

export const projectsQuery = groq`
  *[_type == "project" && defined(slug.current)]
    | order(coalesce(order, 9999) asc, year desc) { ${projectFields} }
`

export const projectBySlugQuery = groq`
  *[_type == "project" && slug.current == $slug][0] { ${projectFields} }
`

export const projectSlugsQuery = groq`
  *[_type == "project" && defined(slug.current)][].slug.current
`

export const siteSettingsQuery = groq`
  *[_type == "siteSettings"][0] {
    bio,
    showreelUrl,
    email,
    socials[]{ label, url },
    clientLogos
  }
`
