import { Hud } from '@/components/dom/chrome/Hud'
import { WebGLTarget } from '@/components/dom/WebGLTarget'
import { Contact } from '@/components/dom/sections/Contact'
import { EditorIntro } from '@/components/dom/sections/EditorIntro'
import { Finale } from '@/components/dom/sections/Finale'
import { Hero } from '@/components/dom/sections/Hero'
import { HeroStage } from '@/components/dom/sections/HeroStage'
import { WorkGrid } from '@/components/dom/sections/WorkGrid'
import styles from './page.module.css'

export default function HomePage() {
  return (
    <main className={styles.page}>
      <Hud />
      {/* The sticker field's rect — see page.module.css. */}
      <WebGLTarget targetId="page-field" className={styles.stickerField} aria-hidden="true" />
      {/* All three share one WebGL ground, so none of the boundaries between
          them is a colour change — see HeroStage. */}
      <HeroStage>
        <Hero />
        <EditorIntro />
        <WorkGrid standalone={false} />
        {/* Inside the stage too, so it sits on the same black the work grid
            handed over to rather than introducing a ground of its own. */}
        <Finale />
      </HeroStage>
      <Contact standalone={false} />
    </main>
  )
}
