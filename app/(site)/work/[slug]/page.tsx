import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Hud } from '@/components/dom/chrome/Hud'
import { SurfaceTheme } from '@/components/dom/chrome/SurfaceTheme'
import { ProjectDetail } from '@/components/dom/sections/ProjectDetail'
import { PROJECTS } from '@/lib/placeholder-content'

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const project = PROJECTS.find((p) => p.slug === slug)
  return { title: project?.title ?? 'Project' }
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const index = PROJECTS.findIndex((p) => p.slug === slug)
  if (index === -1) notFound()

  const project = PROJECTS[index]
  const next = PROJECTS[(index + 1) % PROJECTS.length]

  return (
    <main>
      {/* Dark screen — the nav, HUD and footer invert to match. */}
      <SurfaceTheme value="dark" />
      <Hud status={project.client} />
      <ProjectDetail project={project} next={next} />
    </main>
  )
}
