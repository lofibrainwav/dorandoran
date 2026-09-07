import { FamilyOperatingHero } from '@/components/family-operating-hero'
import { normalizeAdapterOutput, projectFamilyOperatingPerson, projectOperatingWatch } from '@/lib/family-os'

const demoObservations = normalizeAdapterOutput('public-demo-calendar', [
  {
    id: 'demo-current', kind: 'schedule', sourceRef: 'public-demo', observedAt: '2026-09-07T16:00:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['demo-current-evidence'],
    sixW1H: {
      who: { personIds: ['person-demo-anchor'] }, what: { label: 'School day' },
      when: { start: '2026-09-07T16:00:00Z', end: '2026-09-07T21:00:00Z', timeZone: 'America/Los_Angeles' },
      where: { label: 'Los Angeles area', coordinates: { latitude: 34.0522, longitude: -118.2437 } },
    }, continuity: { recordedAt: '2026-09-07T16:00:00Z' },
  },
  {
    id: 'demo-next', kind: 'schedule', sourceRef: 'public-demo', observedAt: '2026-09-07T18:00:00Z',
    evidenceState: 'confirmed', evidenceRefs: ['demo-next-evidence'],
    sixW1H: {
      who: { personIds: ['person-demo-anchor'] }, what: { label: 'Afternoon activity' },
      when: { start: '2026-09-07T22:00:00Z', end: '2026-09-07T23:00:00Z', timeZone: 'America/Los_Angeles' },
    }, continuity: { recordedAt: '2026-09-07T18:00:00Z' },
  },
])

const publicDemo = projectFamilyOperatingPerson({
  personId: 'person-demo-anchor', label: 'Jayden', now: '2026-09-07T19:00:00Z', observations: demoObservations,
  outcome: 'No live-location claim is made from a calendar schedule',
  modules: [
    { id: 'schedule', label: 'Schedule' }, { id: 'school', label: 'School' },
    { id: 'activities', label: 'Activities' }, { id: 'learning', label: 'Learning' },
  ],
})

const publicDemoWatch = projectOperatingWatch({
  eventId: 'demo-next', targetEventId: 'calendar:public-demo/demo-next', title: 'Demo schedule item', protected: true,
  state: 'changed', nextStep: 'prepare', needsHumanAttention: false,
  changeKinds: ['start'], hints: ['review_transition'],
  reality: { start: '2026-09-07T22:00:00Z' }, evidenceRefs: ['demo-watch-evidence'],
})

export default function HomePage() {
  return (
    <main>
      <FamilyOperatingHero person={publicDemo} watch={publicDemoWatch} />
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
