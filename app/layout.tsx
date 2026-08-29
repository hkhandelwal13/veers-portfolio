import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { SmoothScrollProvider } from '@/components/providers/SmoothScrollProvider'
import { WebGLCanvas } from '@/components/webgl/WebGLCanvas'
import './globals.css'

/**
 * TikTok Sans, self-hosted (CLAUDE.md §3). Variable across weight 300–900 with
 * an optical-size axis, latin subset only — swap in more subsets if the copy
 * ever needs them.
 */
const tiktokSans = localFont({
  src: '../public/fonts/TikTokSans-Variable.woff2',
  variable: '--font-tiktok-sans',
  weight: '300 900',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'Veerlabs — Video Editor',
  description: 'Selected work in editing, colour and motion.',
}

export const viewport: Viewport = {
  themeColor: '#07090f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={tiktokSans.variable}>
      <body>
        {/* The canvas is mounted once, outside the route tree, so it survives
            navigation — Phase 4's dot-matrix page transitions depend on that. */}
        <WebGLCanvas />
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  )
}
