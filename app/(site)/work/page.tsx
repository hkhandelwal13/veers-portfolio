import type { Metadata } from 'next'
import { Hud } from '@/components/dom/chrome/Hud'
import { WorkGrid } from '@/components/dom/sections/WorkGrid'

export const metadata: Metadata = { title: 'Work' }

export default function WorkPage() {
  return (
    <main>
      <Hud status="Selected work" />
      <WorkGrid />
    </main>
  )
}
