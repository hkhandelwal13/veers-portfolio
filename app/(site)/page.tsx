import { Hud } from '@/components/dom/chrome/Hud'
import { EditorIntro } from '@/components/dom/sections/EditorIntro'
import { Hero } from '@/components/dom/sections/Hero'
import { HeroStage } from '@/components/dom/sections/HeroStage'
import { WorkGrid } from '@/components/dom/sections/WorkGrid'

export default function HomePage() {
  return (
    <main>
      <Hud status="0174 X 0129 Y" />
      <HeroStage>
        <Hero />
        <EditorIntro />
      </HeroStage>
      <WorkGrid standalone={false} />
    </main>
  )
}
