"use client"

import { useMemo, useState } from 'react'
import { FamilyGlobe } from './family-globe'
import { TemporalZoomGrid } from './temporal-zoom-grid'
import type { FamilyOperatingPersonReadModel } from '@/lib/family-os/family-operating-read-model'
import type { OperatingHandoffProjection, OperatingWatchProjection } from '@/lib/family-os/operating-coordination-read-model'
import type { OperatingPresenceProjection, OperatingRouteProjection } from '@/lib/family-os/operating-route-presence-read-model'
import type { TemporalGridDisplayProjection } from '@/lib/family-os/temporal-grid'
import type { PastJourneyExperienceProjection } from '@/lib/family-os/past-journey-experience'
import type { TimeScale } from '@/lib/family-os/zoom-contract'

function formatClock(start?: string, timeZone?: string): string | null {
  if (!start || !timeZone) return null
  try {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(start))
  } catch {
    return null
  }
}

const scales: Array<{ id: TimeScale; label: string }> = [
  { id: 'past', label: 'Past Journey' },
  { id: 'year', label: 'Year' },
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'This Week' },
  { id: 'today', label: 'Today' },
  { id: 'now', label: 'Now' },
]

export function FamilyOperatingHero({
  person,
  watch,
  handoff,
  presence,
  route,
  monthGrid,
  yearGrid,
  journey,
}: {
  person: FamilyOperatingPersonReadModel
  watch?: OperatingWatchProjection | null
  handoff?: OperatingHandoffProjection | null
  presence?: OperatingPresenceProjection | null
  route?: OperatingRouteProjection | null
  monthGrid?: TemporalGridDisplayProjection | null
  yearGrid?: TemporalGridDisplayProjection | null
  journey?: PastJourneyExperienceProjection | null
}) {
  const [timeScale, setTimeScale] = useState<TimeScale>('today')
  const [personFocused, setPersonFocused] = useState(false)
  const nextClock = formatClock(person.nextWhen?.start, person.nextWhen?.timeZone)
  const nextLabel = nextClock ? `${person.next} · ${nextClock}` : person.next
  const routeLabel = route
    ? route.state === 'clear' && route.routineState === 'proven_tight_fit'
      ? 'Clear · proven tight fit'
      : `${route.state} · ${route.routineState}`
    : null
  const selectedGrid = timeScale === 'month' ? monthGrid : timeScale === 'year' ? yearGrid : null
  const journeyPoints = useMemo(() => (journey?.clusters ?? []).map((cluster) => ({
    longitude: cluster.coordinates.longitude,
    latitude: cluster.coordinates.latitude,
    label: `${cluster.label} · ${cluster.memoryCount} memories`,
  })), [journey])
  const summary = useMemo(() => {
    if (timeScale === 'past') return 'Past Journey shows memory and travel history without changing today’s operational truth.'
    if (timeScale === 'year') return 'Zoomed out to the year: large milestones stay visible, small details fold away.'
    if (timeScale === 'month') return 'Month view favors patterns and preparation over individual minute-by-minute blocks.'
    if (timeScale === 'week') return 'The family rhythm widens into a Sunday-first week.'
    return `${person.label}: ${person.now}. Next: ${nextLabel}.`
  }, [nextLabel, person, timeScale])

  return (
    <section className="operating-hero" aria-labelledby="hero-title">
      <div className="operating-topbar">
        <div>
          <p className="hero-kicker">DoranDoran · Family OS</p>
          <h1 id="hero-title">One family. One living timeline.</h1>
        </div>
        <nav className="time-zoom" aria-label="Time zoom">
          {scales.map((scale) => (
            <button key={scale.id} type="button" aria-pressed={timeScale === scale.id} onClick={() => setTimeScale(scale.id)}>
              {scale.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="operating-stage">
        <FamilyGlobe
          timeScale={timeScale}
          focusPoint={person.place.coordinates ? {
            longitude: person.place.coordinates.longitude,
            latitude: person.place.coordinates.latitude,
            label: person.place.label ?? 'Scheduled place',
          } : undefined}
          journeyPoints={journeyPoints}
        />
        <div className="globe-vignette" aria-hidden="true" />
        {selectedGrid ? <TemporalZoomGrid grid={selectedGrid} /> : null}
        <div className="globe-label">
          <span>{timeScale === 'past' ? 'World · Past Journey' : timeScale === 'year' ? 'Year · Wide view' : 'Los Angeles · Family context'}</span>
          <strong>永</strong>
          <small>Past → Now</small>
        </div>

        {timeScale === 'past' ? (
          <aside className="past-journey-panel" aria-label="Past Journey memories">
            <div className="person-row">
              <div><span>Past Journey</span><small>Photo + place memory socket</small></div>
              <span className="presence-pill">{journey?.stories.length ?? 0} stories · {journey?.clusters.length ?? 0} places</span>
            </div>
            <div className="journey-memory-list">
              {(journey?.stories ?? []).map((story) => (
                <article key={story.id}>
                  <strong>{story.summary}</strong>
                  <span>{story.start.slice(0, 10)}{story.end !== story.start ? ` → ${story.end.slice(0, 10)}` : ''}</span>
                </article>
              ))}
              {!journey?.stories.length ? <p>No verified memory stories yet.</p> : null}
            </div>
          </aside>
        ) : (
        <aside className="now-panel" aria-label="Current family context">
          <div className="person-row">
            <button className="person-focus" type="button" onClick={() => setPersonFocused((value) => !value)} aria-expanded={personFocused}>
              <span>{person.label}</span>
              <small>{personFocused ? 'Close person view' : 'Focus person'}</small>
            </button>
            <span className={`presence-pill presence-pill--${person.place.state.toLowerCase().replace(' ', '-')}`}>{person.place.state}</span>
          </div>

          <div className="story-rail">
            <article><small>NOW</small><strong>{person.now}</strong></article>
            <article><small>NEXT</small><strong>{nextLabel}</strong></article>
            {presence ? <article><small>PRESENCE</small><strong>{presence.label}</strong></article> : null}
            {routeLabel ? <article><small>ROUTE</small><strong>{routeLabel}</strong></article> : null}
            {watch ? <article><small>WATCH</small><strong>{watch.label}</strong></article> : null}
            {handoff ? <article><small>HANDOFF</small><strong>{handoff.state} · {handoff.fromMode} → {handoff.toMode}</strong></article> : null}
            {person.outcome ? <article><small>OUTCOME</small><strong>{person.outcome}</strong></article> : null}
          </div>

          {personFocused && person.modules?.length ? (
            <div className="person-modules">
              {person.modules.map((module) => (
                <span key={module.id} data-state={module.state ?? 'unknown'}>
                  <strong>{module.label}</strong>
                  {module.statusLabel ? <small>{module.statusLabel}</small> : null}
                </span>
              ))}
            </div>
          ) : null}
        </aside>
        )}
      </div>

      <footer className="operating-summary">
        <p>{summary}</p>
        <div className="virtue-rail" aria-label="Context integrity lenses">
          <span>眞 Truth</span><span>善 Safety</span><span>美 Clarity</span><span>仁 Human</span><span>孝 Consent</span>
        </div>
      </footer>
    </section>
  )
}
