/**
 * Stand-in section. Phase 2 replaces these with the real layouts from the
 * Figma handoff; for now they give the page enough height to scroll.
 */
export function PlaceholderSection({
  index,
  title,
  body,
}: {
  index: string
  title: string
  body: string
}) {
  return (
    <section className="section" id={title.toLowerCase()}>
      <div className="container section__inner">
        <span className="label">{index} — {title}</span>
        <h2 className="section__title">{title}</h2>
        <p className="section__body">{body}</p>
      </div>
    </section>
  )
}
