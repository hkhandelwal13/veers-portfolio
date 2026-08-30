import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The dev overlay badge sits over the bottom-left HUD corner and shows up in
  // every review screenshot. Nothing depends on it.
  devIndicators: false,
  // CLAUDE.md is the client's build spec and the source of truth for this
  // project; `next dev` otherwise appends its own agent-rules block to it.
  agentRules: false,
  images: {
    // Sanity CDN is the only remote image host.
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.sanity.io' }],
  },
  // Phase 4 note: when shaders/ starts holding real .glsl files, add a turbopack
  // rule to import them as raw strings, or keep them as TS template literals.
}

export default nextConfig
