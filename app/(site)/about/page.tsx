import type { Metadata } from 'next'
import { Hud } from '@/components/dom/chrome/Hud'
import { About } from '@/components/dom/sections/About'

export const metadata: Metadata = { title: 'About' }

export default function AboutPage() {
  return (
    <main>
      <Hud status="About" />
      <About />
    </main>
  )
}
