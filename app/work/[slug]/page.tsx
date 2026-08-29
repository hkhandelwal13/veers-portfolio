import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProject, getProjectSlugs } from '@/lib/sanity/fetch'
import { isConfigured } from '@/sanity/env'

/**
 * Project detail — a stub. The custom <video> player, credits layout and
 * "next project" link land in Phases 2 and 5; this exists so the route from
 * CLAUDE.md §9 is real and the data path is proven end to end.
 */

export async function generateStaticParams() {
  const slugs = await getProjectSlugs()
  return slugs.map((slug) => ({ slug }))
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = await getProject(slug)

  // With Sanity configured, an unknown slug is a genuine 404. Without it,
  // there's no content to find yet, so show what the page will hold instead.
  if (!project && isConfigured) notFound()

  return (
    <main className="section">
      <div className="container section__inner">
        <Link href="/" className="label">← Back</Link>
        <h1 className="section__title">{project?.title ?? `Project: ${slug}`}</h1>
        <p className="section__body">
          {project?.description ??
            'Placeholder. Once Sanity holds this project, the page shows the full R2 video in a custom player, plus client, role, year, categories and credits.'}
        </p>
      </div>
    </main>
  )
}
