import { Hero } from '@/components/dom/Hero'
import { PlaceholderSection } from '@/components/dom/PlaceholderSection'
import { WorkGridPlaceholder } from '@/components/dom/WorkGridPlaceholder'
import { getProjects, getSiteSettings } from '@/lib/sanity/fetch'

export default async function HomePage() {
  // Both return empty until Sanity is configured — the page renders placeholders.
  const [projects, settings] = await Promise.all([getProjects(), getSiteSettings()])

  return (
    <main>
      <Hero />

      <WorkGridPlaceholder projects={projects} />

      <PlaceholderSection
        index="02"
        title="About"
        body={
          settings?.bio ??
          'Bio comes from Sanity (siteSettings.bio). Until then this paragraph exists to give the page height, so smooth scroll and the hero’s scroll reaction have something to work against.'
        }
      />

      <PlaceholderSection
        index="03"
        title="Services"
        body="Editing, colour, motion graphics. Section layout lands in Phase 2 from the Figma handoff."
      />

      <PlaceholderSection
        index="04"
        title="Contact"
        body={settings?.email ?? 'hello@veerlabs.example — replace from siteSettings.email.'}
      />
    </main>
  )
}
