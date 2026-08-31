import { Hud } from '@/components/dom/chrome/Hud'
import { Contact } from '@/components/dom/sections/Contact'
import { EditorIntro } from '@/components/dom/sections/EditorIntro'
import { Hero } from '@/components/dom/sections/Hero'
import { HeroStage } from '@/components/dom/sections/HeroStage'
import { WorkGrid } from '@/components/dom/sections/WorkGrid'

export default function HomePage() {
  return (
    <main>
      <Hud status="0174 X 0129 Y" />
      {/* All three share one WebGL ground, so none of the boundaries between
          them is a colour change — see HeroStage. */}
      <HeroStage>
        <Hero />
        <EditorIntro />
        <WorkGrid standalone={false} />
      </HeroStage>
      <Contact standalone={false} />
    </main>
  )
}
