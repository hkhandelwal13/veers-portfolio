import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import Script from 'next/script'
import { SmoothScrollProvider } from '@/components/providers/SmoothScrollProvider'
import { WebGLCanvas } from '@/components/webgl/WebGLCanvas'
import { DEFAULT_THEME, themeBootstrapScript } from '@/lib/theme'
import './globals.css'

/** Self-hosted TikTok Sans 400/700 for body/display and the supplied
 * Tronica Mono 400 for navigation and HUD labels. Space Mono stays available
 * as the original mono family and fallback. */
const tiktokSans = localFont({
  src: [
    { path: '../public/fonts/TikTokSans-Variable.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/TikTokSans-Variable.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-tiktok-sans',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})

const spaceMono = localFont({
  src: [
    { path: '../public/fonts/SpaceMono-Regular.woff2', weight: '400', style: 'normal' },
  ],
  variable: '--font-space-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
})

const tronicaMono = localFont({
  src: '../public/fonts/TronicaMono-Regular.ttf',
  variable: '--font-tronica-mono',
  weight: '400',
  style: 'normal',
  display: 'swap',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
})

export const metadata: Metadata = {
  title: {
    default: 'Veerlabs',
    template: '%s — Veerlabs',
  },
  description: 'Editing, colour and motion graphics. Selected work by Veerlabs.',
}

export const viewport: Viewport = {
  // The default theme's ground. The toggle rewrites this tag's content, so the
  // browser chrome follows the page instead of pinning to one palette.
  themeColor: DEFAULT_THEME === 'dark' ? '#0a1038' : '#cbe2f5',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The bootstrap script below writes data-theme onto this element before
    // React hydrates, which is exactly the mismatch this suppresses.
    <html
      lang="en"
      className={`${tiktokSans.variable} ${spaceMono.variable} ${tronicaMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Runs before first paint. Reading the stored theme in an effect
            instead would paint the default first and swap after hydration — a
            full-page flash on every load for anyone on the non-default.
            next/script rather than a bare <script>: React 19 warns on inline
            script elements it sees during a client render, and this one is in
            the layout, which is part of every render. */}
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrapScript}
        </Script>
        {/* Mounted once, outside the route tree, so it survives navigation —
            Phase 4's page transitions depend on that. */}
        <WebGLCanvas />
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  )
}
