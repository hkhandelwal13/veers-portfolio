import type { Metadata } from 'next'
import { Hud } from '@/components/dom/chrome/Hud'
import { Contact } from '@/components/dom/sections/Contact'

export const metadata: Metadata = { title: 'Contact' }

export default function ContactPage() {
  return (
    <main>
      <Hud />
      <Contact />
    </main>
  )
}
