import Link from 'next/link'

const nodes = [
  { id: 'jay', label: 'Jay', role: 'personal time', className: 'gravity-node gravity-node--jay' },
  { id: 'julie', label: 'Julie', role: 'personal time', className: 'gravity-node gravity-node--julie' },
  { id: 'family', label: 'Family Ops', role: 'shared rhythm', className: 'gravity-node gravity-node--family' },
]

export function FamilyGravityHero() {
  return (
    <section className="hero-shell" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="hero-kicker">Chad Family OS</p>
        <h1 id="hero-title">Your family, in sync.</h1>
        <p className="hero-lede">
          Jayden anchors the family week. Jay and Julie stay independent until a real
          handoff, route, update, or decision connects them.
        </p>
        <div className="hero-actions">
          <Link className="hero-button hero-button--primary" href="/family">Open Family Week</Link>
          <a className="hero-button hero-button--quiet" href="#how-chad-knows">See how Chad knows</a>
        </div>
        <p className="hero-proof">Every meaningful change can point back to its evidence.</p>
      </div>
      <div className="gravity-stage" aria-label="Family coordination map">
        <div className="gravity-grid" aria-hidden="true" />
        <div className="gravity-orbit gravity-orbit--one" aria-hidden="true" />
        <div className="gravity-orbit gravity-orbit--two" aria-hidden="true" />
        <svg className="gravity-lines" viewBox="0 0 720 560" aria-hidden="true">
          <path d="M170 310 C250 250 300 250 360 280" />
          <path d="M550 300 C470 245 425 250 360 280" />
          <path d="M360 120 C360 180 360 225 360 280" />
          <path className="gravity-line--soft" d="M360 280 C360 350 360 395 360 455" />
        </svg>

        {nodes.map((node) => (
          <div className={node.className} key={node.id}>
            <span>{node.label}</span>
            <small>{node.role}</small>
          </div>
        ))}

        <div className="gravity-node gravity-node--anchor">
          <span>Jayden</span>
          <small>week anchor</small>
        </div>
        <div className="gravity-node gravity-node--chad">
          <span>Chad</span>
          <small>coordinates only when needed</small>
        </div>
        <div className="gravity-edge-label gravity-edge-label--left">handoff</div>
        <div className="gravity-edge-label gravity-edge-label--right">support</div>
        <div className="gravity-edge-label gravity-edge-label--top">shared schedule</div>
        <p className="gravity-caption">Connections appear only when coordination is real.</p>
      </div>
    </section>
  )
}
