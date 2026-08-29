import type { Project } from '@/lib/sanity/types'

/**
 * The work grid, as bare CSS grid.
 *
 * This is the element that matters most for later phases: from Phase 3 each
 * card's getBoundingClientRect() positions a WebGL plane, so the grid geometry
 * (columns, gap, card aspect ratio) is the contract between CSS and WebGL.
 * Cards carry data-webgl-slot so the rect-sync system can find them.
 *
 * Hover-to-play preview video is Phase 4 — these are static frames for now.
 */
export function WorkGridPlaceholder({ projects }: { projects: Project[] }) {
  const cards: { key: string; title: string; meta: string }[] = projects.length
    ? projects.map((p) => ({
        key: p._id,
        title: p.title,
        meta: [p.client, p.year].filter(Boolean).join(' · ') || '—',
      }))
    : Array.from({ length: 4 }, (_, i) => ({
        key: `placeholder-${i}`,
        title: `Project ${String(i + 1).padStart(2, '0')}`,
        meta: 'Awaiting Sanity content',
      }))

  return (
    <section className="section" id="work">
      <div className="container">
        <span className="label">01 — Work</span>
        <ul className="work-grid">
          {cards.map((card) => (
            <li key={card.key} className="card" data-webgl-slot="card">
              <div className="card__frame" />
              <div className="card__meta">
                <h3 className="card__title">{card.title}</h3>
                <span className="label">{card.meta}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
