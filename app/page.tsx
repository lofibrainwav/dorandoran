import { FamilyGravityHero } from '@/components/family-gravity-hero'

export default function HomePage() {
  return (
    <main>
      <FamilyGravityHero />
      <section className="home-explainer" id="how-chad-knows" aria-labelledby="how-title">
        <p className="hero-kicker">How Chad knows</p>
        <h2 id="how-title">Quiet when nothing changed. Specific when something did.</h2>
        <div className="evidence-steps">
          <article><strong>Observe</strong><span>Calendar, email, and family context stay separate.</span></article>
          <article><strong>Reconcile</strong><span>Only matching facts are compared. Unknown stays unknown.</span></article>
          <article><strong>Coordinate</strong><span>Jay or Julie connect only when a real handoff needs them.</span></article>
          <article><strong>Explain</strong><span>Every important change can expose the evidence behind it.</span></article>
        </div>
      </section>
    </main>
  )
}
