/**
 * Placeholder content, lifted from the approved wireframes so the static build
 * is reviewable at real text lengths (variable-length titles, multiple tags,
 * a full credits list — the cases DESIGN_BRIEF §5 asks the layout to hold).
 *
 * Phase 5 replaces this with Sanity data. Pages already prefer real content
 * when the CMS returns any, so this is purely the empty-state fallback.
 */

export type PlaceholderCredit = { role: string; name: string }

export type PlaceholderProject = {
  slug: string
  title: string
  client: string
  role: string
  year: number
  runtime: string
  categories: string[]
  description: string[]
  credits: PlaceholderCredit[]
}

export const CATEGORIES = [
  'Commercial',
  'Music Video',
  'Documentary',
  'Motion',
] as const

export const PROJECTS: PlaceholderProject[] = [
  {
    slug: 'northwind-season-film',
    title: 'Northwind — Season Film',
    client: 'Northwind Outdoor',
    role: 'Editor · Colorist',
    year: 2026,
    runtime: '02:08',
    categories: ['Commercial', 'Color'],
    description: [
      'A season-opening brand film cut from eleven days of run-and-gun coverage across three ranges. The assembly leaned on natural sound and long lens holds to keep the scale legible.',
      'Graded warm in the valleys and cool at altitude, so the film reads as one continuous climb.',
    ],
    credits: [
      { role: 'Director', name: 'A. Rajput' },
      { role: 'DOP', name: 'M. Iyer' },
      { role: 'Sound', name: 'K. Desai' },
      { role: 'Production', name: 'Fieldhouse' },
    ],
  },
  {
    slug: 'halcyon-low-tide',
    title: 'Halcyon — "Low Tide"',
    client: 'Halcyon',
    role: 'Edit · Color · Online',
    year: 2025,
    runtime: '03:41',
    categories: ['Music Video'],
    description: [
      'Single-take performance intercut with 16mm plates. The cut sits on the beat only twice; everywhere else it drifts deliberately behind it.',
    ],
    credits: [
      { role: 'Director', name: 'S. Menon' },
      { role: 'DOP', name: 'R. Fernandes' },
      { role: 'Label', name: 'Tidepool' },
    ],
  },
  {
    slug: 'the-long-room',
    title: 'The Long Room (Doc, 74 min)',
    client: 'Fieldhouse Films',
    role: 'Editor',
    year: 2025,
    runtime: '74:00',
    categories: ['Documentary', 'Edit', 'Sound'],
    description: [
      'Feature documentary assembled from 240 hours of vérité and eighteen sit-down interviews. Structured in four movements around a single room.',
    ],
    credits: [
      { role: 'Director', name: 'P. Nair' },
      { role: 'Producer', name: 'L. Bhatt' },
      { role: 'Sound', name: 'K. Desai' },
    ],
  },
  {
    slug: 'orbit-system-titles',
    title: 'Orbit System — Titles',
    client: 'Orbit',
    role: 'Motion Design',
    year: 2024,
    runtime: '01:12',
    categories: ['Motion Graphics'],
    description: [
      'Main-title sequence built on a rotating orthographic grid, with type set on the same 12-column rhythm as the product it introduces.',
    ],
    credits: [
      { role: 'Creative Director', name: 'V. Shah' },
      { role: 'Design', name: 'Veerlabs' },
    ],
  },
]

export const SITE = {
  email: 'hello@veerlabs.studio',
  basedIn: 'Mumbai, IN',
  since: '2016',
  toolkit: 'Resolve · Premiere · AE',
  showreelRuntime: '02:14',
  totalProjects: 12,
  bio: [
    'Veerlabs is the studio practice of a video editor working across commercials, music videos and long-form documentary. The work starts in the assembly and stays there — structure first, polish after.',
    'Ten years cutting for agencies, labels and independent producers, with colour and finishing handled in-house so the picture never changes hands.',
  ],
  socials: [
    { label: 'Instagram', short: 'IG', url: 'https://instagram.com' },
    { label: 'Vimeo', short: 'Vimeo', url: 'https://vimeo.com' },
    { label: 'YouTube', short: 'YT', url: 'https://youtube.com' },
    { label: 'LinkedIn', short: 'IN', url: 'https://linkedin.com' },
  ],
  services: [
    {
      index: '01',
      title: 'Editing',
      body: 'Offline from rushes to picture lock, on features, brand films and campaign cutdowns.',
      items: ['Offline / assembly', 'Story structure', 'Versioning & cutdowns'],
    },
    {
      index: '02',
      title: 'Color',
      body: 'Grading and finishing in Resolve, delivered to broadcast, cinema or social spec.',
      items: ['Grade & look dev', 'HDR / SDR delivery', 'Conform & online'],
    },
    {
      index: '03',
      title: 'Motion Graphics',
      body: 'Titles, type animation and cleanup built to sit inside the cut, not on top of it.',
      items: ['Titles & lower thirds', 'Type animation', 'Tracking / cleanup'],
    },
  ],
}
