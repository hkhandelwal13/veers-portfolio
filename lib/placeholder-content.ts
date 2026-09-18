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
  /** The card at rest, and the still behind the player. */
  poster: string
  /** What the hover reveal uncovers. Short, silent, looping. */
  preview: string
  /** The film itself, on the project page. */
  video: string
}

export const CATEGORIES = [
  'Commercial',
  'Music Video',
  'Documentary',
  'Motion',
] as const

/**
 * The one piece of real footage delivered so far, standing in for all eight.
 *
 * Every project points at it, which is what the grid needs to be built and
 * judged: the reveal, the clip under it and the player are all exercised, and
 * swapping in the remaining seven is a matter of changing these strings —
 * or, once the CMS is connected, of not having them here at all.
 *
 * Serving as both preview and full film for now, per the brief. It is 10
 * seconds and 1.4 MB, already H.264 with its index at the front, so nothing is
 * being asked of it that a real preview loop would not also do.
 */
const SHOWREEL = {
  poster: '/work/showreel-poster.jpg',
  preview: '/work/showreel.mp4',
  video: '/work/showreel.mp4',
} as const

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
    ...SHOWREEL,
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
    ...SHOWREEL,
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
    ...SHOWREEL,
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
    ...SHOWREEL,
    credits: [
      { role: 'Creative Director', name: 'V. Shah' },
      { role: 'Design', name: 'Veerlabs' },
    ],
  },
  {
    slug: 'meridian-tasting-notes',
    title: 'Meridian — Tasting Notes',
    client: 'Meridian Coffee',
    role: 'Editor · Color',
    year: 2026,
    runtime: '01:34',
    categories: ['Commercial'],
    description: [
      'Six roasts, six rooms, one continuous move. Cut so the hand-offs land on the pour rather than on the cut, which is where the eye already is.',
    ],
    ...SHOWREEL,
    credits: [
      { role: 'Director', name: 'N. Chaudhary' },
      { role: 'DOP', name: 'M. Iyer' },
      { role: 'Agency', name: 'Fieldhouse' },
    ],
  },
  {
    slug: 'kestrel-night-shift',
    title: 'Kestrel — "Night Shift"',
    client: 'Kestrel',
    role: 'Edit · Online',
    year: 2025,
    runtime: '04:02',
    categories: ['Music Video', 'Edit'],
    description: [
      'Shot across one night in a working depot. The performance was covered twice and the two takes are intercut on a fixed eight-bar rhythm, so the room changes while the band does not.',
    ],
    ...SHOWREEL,
    credits: [
      { role: 'Director', name: 'S. Menon' },
      { role: 'DOP', name: 'R. Fernandes' },
      { role: 'Label', name: 'Tidepool' },
    ],
  },
  {
    slug: 'harbour-lines',
    title: 'Harbour Lines (Short, 22 min)',
    client: 'Independent',
    role: 'Editor · Sound',
    year: 2024,
    runtime: '22:00',
    categories: ['Documentary', 'Sound'],
    description: [
      'A portrait of a dock crew told entirely in wide shots and radio chatter. No interviews; the structure is a single shift, start to finish.',
    ],
    ...SHOWREEL,
    credits: [
      { role: 'Director', name: 'P. Nair' },
      { role: 'Producer', name: 'L. Bhatt' },
    ],
  },
  {
    slug: 'altimeter-brand-system',
    title: 'Altimeter — Brand System',
    client: 'Altimeter',
    role: 'Motion Design',
    year: 2024,
    runtime: '00:48',
    categories: ['Motion Graphics', 'Commercial'],
    description: [
      'A toolkit rather than a film: eighteen transitions and a title system built to survive being re-cut by someone else, in-house, for two more years.',
    ],
    ...SHOWREEL,
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
  totalProjects: 8,
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
