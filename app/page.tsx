import { FamilyOperatingHero } from '@/components/family-operating-hero'

const publicDemo = {
  id: 'person-demo-anchor',
  label: 'Jayden',
  placeLabel: 'Los Angeles area',
  placeState: 'Scheduled' as const,
  longitude: -118.2437,
  latitude: 34.0522,
  now: 'School day',
  next: 'Afternoon activity at 3:00 PM',
  watch: 'Pickup handoff is visible only when coordination is needed',
  outcome: 'No live-location claim is made from a calendar schedule',
  modules: [
    { id: 'schedule', label: 'Schedule' },
    { id: 'school', label: 'School' },
    { id: 'activities', label: 'Activities' },
    { id: 'learning', label: 'Learning' },
  ],
}

export default function HomePage() {
  return (
    <main>
      <FamilyOperatingHero person={publicDemo} />
      <section className="home-explainer" aria-labelledby="grammar-title">
        <p className="hero-kicker">Universal context grammar</p>
        <h2 id="grammar-title">Any source can plug in. Family truth stays provider-neutral.</h2>
        <div className="evidence-steps">
          <article><strong>Observe</strong><span>Provider adapters emit only what they actually know.</span></article>
          <article><strong>6W1H</strong><span>Who, what, when, where, why, and how stay explicit or unknown.</span></article>
          <article><strong>眞善美仁孝</strong><span>Evidence, safety, clarity, human context, and consent stay separate.</span></article>
          <article><strong>永</strong><span>Past → Year → Month → Week → Today → Now stays one continuity axis.</span></article>
        </div>
      </section>
    </main>
  )
}
