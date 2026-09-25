/** Delivered showreels and site copy; CMS integration is deferred. */

export type PlaceholderCredit = { role: string; name: string }

export type PlaceholderProject = {
  slug: string
  title: string
  client: string
  role: string
  year?: number
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

export const CATEGORIES = ['Showreel'] as const

/** Delivered media. Editorial metadata can be added when supplied. */
export const PROJECTS: PlaceholderProject[] = [
  {
    slug: 'showreel-1',
    title: 'Ad Concept for Planta',
    client: '',
    role: '',
    runtime: '00:10',
    categories: ['Showreel'],
    description: [],
    credits: [],
    poster: '/work/showreel-poster.jpg',
    preview: '/work/showreel.mp4',
    video: '/work/showreel.mp4',
  },
  {
    slug: 'showreel-2',
    title: 'Ad Concept Humain Fabric',
    client: '',
    role: '',
    runtime: '01:46',
    categories: ['Showreel'],
    description: [],
    credits: [],
    poster: '/work/showreel-2-poster.jpg',
    preview: '/work/showreel-2-preview.mp4',
    video: '/work/showreel-2.mp4',
  },
  {
    slug: 'showreel-3',
    title: 'SAAS Product Explainer for Codex',
    client: '',
    role: '',
    runtime: '00:36',
    categories: ['Showreel'],
    description: [],
    credits: [],
    poster: '/work/showreel-3-poster.jpg',
    preview: '/work/showreel-3-preview.mp4',
    video: '/work/showreel-3.mp4',
  },
  {
    slug: 'showreel-4',
    title: '2D Motion Design Concept',
    client: '',
    role: '',
    runtime: '00:19',
    categories: ['Showreel'],
    description: [],
    credits: [],
    poster: '/work/showreel-4-poster.jpg',
    preview: '/work/showreel-4-preview.mp4',
    video: '/work/showreel-4.mp4',
  },
  {
    slug: 'showreel-5',
    title: 'Design Guidelines Explainer Concept for OpenAI',
    client: '',
    role: '',
    runtime: '00:45',
    categories: ['Showreel'],
    description: [],
    credits: [],
    poster: '/work/showreel-5-poster.jpg',
    preview: '/work/showreel-5-preview.mp4',
    video: '/work/showreel-5.mp4',
  },
  {
    slug: 'showreel-6',
    title: 'Ad Concept for Chat-GPT',
    client: '',
    role: '',
    runtime: '00:26',
    categories: ['Showreel'],
    description: [],
    credits: [],
    poster: '/work/showreel-6-poster.jpg',
    preview: '/work/showreel-6-preview.mp4',
    video: '/work/showreel-6.mp4',
  },
]

export const SITE = {
  email: 'workwithveer@gmail.com',
  basedIn: 'Pune, IN',
  since: '2020',
  toolkit: 'After Effects · Premiere Pro',
  showreelRuntime: '02:14',
  totalProjects: PROJECTS.length,
  bio: [
    'Veerlabs is a virtual studio practice focused on motion, creative direction, and editing. Working across commercials, digital campaigns, and branded content, the studio shapes ideas through movement, composition, rhythm, and visual storytelling.',
    'Six years of independent creative practice, working across motion, editing, and creative direction for brands, agencies, and independent projects.',
  ],
  socials: [
    { label: 'Instagram', short: 'IG', url: 'https://www.instagram.com/veerlabs?stkn=MTVqZXhrbGQ1NmE1bw%3D%3D&utm_source=qr' },
    { label: 'Vimeo', short: 'Vimeo', url: 'https://vimeo.com' },
    { label: 'YouTube', short: 'YT', url: 'https://youtube.com' },
    { label: 'LinkedIn', short: 'IN', url: 'https://www.linkedin.com/in/veer-sonawane-200004198/' },
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

