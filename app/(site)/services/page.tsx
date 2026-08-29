import type { Metadata } from 'next'
import { Hud } from '@/components/dom/chrome/Hud'
import { Services } from '@/components/dom/sections/Services'

export const metadata: Metadata = { title: 'Services' }

export default function ServicesPage() {
  return (
    <main>
      <Hud status="Services" />
      <Services />
    </main>
  )
}
