import { Hud } from '@/components/dom/chrome/Hud'
import { EditorIntro } from '@/components/dom/sections/EditorIntro'
import { Hero } from '@/components/dom/sections/Hero'
import { WorkGrid } from '@/components/dom/sections/WorkGrid'

export default function HomePage() {
  return (
    <main>
      <Hud status="0174 X 0129 Y" />
      <Hero />
      <EditorIntro />
      <WorkGrid standalone={false} />
    </main>
  )
}
