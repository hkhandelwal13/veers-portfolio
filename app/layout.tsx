import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { SmoothScrollProvider } from '@/components/providers/SmoothScrollProvider'
import { WebGLCanvas } from '@/components/webgl/WebGLCanvas'
import './globals.css'

/**
 * Type pairing per PHASE2_KICKOFF.md: TikTok Sans for display/headings/body,
 * Space Mono for HUD, labels, meta and nav. Both self-hosted (latin subset) so
 * nothing is fetched from Google at build or runtime. Caveat is deliberately
 * not loaded — it was annotation ink in the wireframes.
 */
const tiktokSans = localFont({
  src: '../public/fonts/TikTokSans-Variable.woff2',
  variable: '--font-tiktok-sans',
  weight: '300 900',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})

const spaceMono = localFont({
  src: [
    { path: '../public/fonts/SpaceMono-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/SpaceMono-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-space-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
})

export const metadata: Metadata = {
  title: {
    default: 'Veerlabs — Video Editor',
    template: '%s — Veerlabs',
  },
  description: 'Editing, colour and motion graphics. Selected work by Veerlabs.',
}

export const viewport: Viewport = {
  themeColor: '#e7e4dd',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${tiktokSans.variable} ${spaceMono.variable}`}>
      <body>
        {/* Mounted once, outside the route tree, so it survives navigation —
            Phase 4's page transitions depend on that. */}
        <WebGLCanvas />
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  )
}
