import { Nav } from '@/components/dom/chrome/Nav'
import { Footer } from '@/components/dom/chrome/Footer'
import { Loader } from '@/components/dom/chrome/Loader'
import { WebGLDebug } from '@/components/dom/WebGLDebug'

/**
 * Shared chrome for every screen: nav (with the mobile menu), the loader, and
 * the footer. The four-corner HUD is mounted per-page rather than here, because
 * its bottom-centre slot carries a per-screen status line and the project
 * detail page flips it to its dark variant.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Loader />
      <WebGLDebug />
      <Nav />
      <div id="main">{children}</div>
      <Footer />
    </>
  )
}
