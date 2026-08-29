/**
 * Hero. The 3D "hello" is rendered by the WebGL stage behind this markup —
 * the DOM here only reserves and composes the space around it (DESIGN_BRIEF
 * "the designer does not design the 3D itself").
 */
export function Hero() {
  return (
    <section className="hero">
      <div className="container hero__inner">
        <header className="hero__top">
          <span className="hero__wordmark">VEERLABS</span>
          <nav className="hero__nav label">
            <a href="#work">Work</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>
        </header>

        {/* Reserved area for the 3D word. Deliberately empty: the model sits
            behind it, and from Phase 3 this element's rect will drive it. */}
        <div className="hero__stage" data-webgl-slot="hero" />

        <footer className="hero__bottom">
          <p className="hero__tagline">
            Video editor. Commercials, music videos and documentary — cut, coloured and
            finished.
          </p>
          <span className="label hero__cue">Scroll</span>
        </footer>
      </div>
    </section>
  )
}
