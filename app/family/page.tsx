import Link from 'next/link'
import { FamilyOperatingHero } from '@/components/family-operating-hero'
import {
  parseHouseholdMembership,
  projectOperatingPresence,
  projectWeekDays,
  resolveHouseholdHome,
  resolveHouseholdTimeZone,
  resolveUniqueChildPersonId,
} from '@/lib/family-os'
import { privateFamilySurfaceEnabled } from '@/lib/server/private-family-surface'
import { loadPrivateCalendarOperatingPerson } from '@/lib/server/private-calendar-operating-source'
import { loadPrivateCalendarTemporalGrids } from '@/lib/server/private-calendar-temporal-source'
import { loadPrivateOperationalFamilyCalendarPerson } from '@/lib/server/private-operational-family-calendar-source'
import { loadPrivatePhotoSnapshot } from '@/lib/server/private-photo-snapshot'
import { projectPrivatePhotoSetupGuidance } from '@/lib/server/private-photo-setup-guidance'
import { loadJaydenLearningModule } from '@/lib/server/jdk-bridge-transport'
import { selectScheduleResult } from '@/lib/server/schedule-result-selection'

export const dynamic = 'force-dynamic'

const baseJaydenModules = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'school', label: 'School' },
  { id: 'activities', label: 'Activities' },
]

function householdChildPersonId() {
  try {
    return resolveUniqueChildPersonId(parseHouseholdMembership(process.env))
  } catch {
    return null
  }
}

function householdHome() {
  try {
    return resolveHouseholdHome(process.env)
  } catch (error) {
    console.error('[family-week] DORANDORAN_HOME_COORDINATES is invalid; falling back to the default home', error)
    return resolveHouseholdHome({})
  }
}

function householdTimeZone() {
  try {
    return resolveHouseholdTimeZone(process.env)
  } catch (error) {
    console.error('[family-week] DORANDORAN_TIME_ZONE is invalid; falling back to the default zone', error)
    return resolveHouseholdTimeZone({})
  }
}

export default async function FamilyWeekPage() {
  const privateEnabled = privateFamilySurfaceEnabled()
  const now = new Date()
  const timeZone = householdTimeZone()
  const home = householdHome()
  const childPersonId = householdChildPersonId()
  // Learning state is derived from the delegated JDK bridge (env + cached live status probe), never from constants.
  // It runs alongside the calendar loaders so a slow bridge never serialises the page.
  const learningPromise = loadJaydenLearningModule()
  // No live location source is wired in production: presence is shown as an explicit Unknown, never guessed.
  const presence = projectOperatingPresence({ state: 'unknown', observedAt: now.toISOString(), evidenceRefs: [] })

  const operationalPromise = childPersonId
    ? loadPrivateOperationalFamilyCalendarPerson({
        personId: childPersonId,
        label: 'Jayden',
        now,
        timeZone,
        modules: baseJaydenModules,
      })
    : Promise.resolve(null)

  const localPrivatePromise = privateEnabled
    ? Promise.all([
        loadPrivateCalendarOperatingPerson({
          personId: 'person-jayden', label: 'Jayden', now,
          timeZone, modules: baseJaydenModules,
        }),
        loadPrivateCalendarTemporalGrids({
          personId: 'person-jayden', now, timeZone,
        }),
        loadPrivatePhotoSnapshot({
          now, maxAgeMs: 24 * 60 * 60 * 1000,
        }),
      ])
    : Promise.resolve([null, null, null] as const)

  const [operationalResult, [privateResult, temporalResult, photoSnapshot], learningModule] = await Promise.all([
    operationalPromise,
    localPrivatePromise,
    learningPromise,
  ])
  if (operationalResult) operationalResult.readModel.modules = [...operationalResult.readModel.modules, learningModule]
  if (privateResult) privateResult.readModel.modules = [...privateResult.readModel.modules, learningModule]
  const scheduleResult = selectScheduleResult(operationalResult, privateResult)
  // UNKNOWN stays explicit: a missing or failed source is not the same as a week with zero facts.
  const scheduleKnown = Boolean(scheduleResult && scheduleResult.sourceHealth !== 'failure')
  const week = projectWeekDays({
    observations: scheduleKnown ? scheduleResult!.observations : [],
    now,
    timeZone,
  })
  const photoResult = photoSnapshot?.result ?? null
  const photoSetup = projectPrivatePhotoSetupGuidance(photoResult, { albumName: process.env.APPLE_PHOTOS_ALBUM_NAME })

  return (
    <main className="min-h-dvh px-4 py-6 md:px-8">
      <header className="mx-auto mb-6 flex max-w-7xl items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Family Week · week of {week.weekStartDate} · {timeZone}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Jayden-centered coordination</h1>
        </div>
        <Link href="/" className="text-sm text-[var(--muted)] underline-offset-4 hover:underline">Public demo</Link>
      </header>

      <section className="mx-auto mb-6 max-w-7xl">
        {scheduleResult ? (
          <>
            <FamilyOperatingHero
              person={scheduleResult.readModel}
              home={home}
              presence={presence}
              monthGrid={temporalResult?.monthGrid}
              yearGrid={temporalResult?.yearGrid}
              journey={photoResult?.experience}
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Family schedule · {scheduleResult.source} · today {scheduleResult.sourceHealth}
              {temporalResult ? ` · temporal ${temporalResult.sourceHealth}` : ''}
              {photoSnapshot ? ` · photo snapshot ${photoSnapshot.status}` : ''}
              {photoResult ? ` · photos ${photoResult.sourceHealth}/${photoResult.sourceState}` : ''}
            </p>
            {'unassignedEventCount' in scheduleResult && scheduleResult.unassignedEventCount > 0 ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {scheduleResult.unassignedEventCount} mixed-calendar item(s) remain unassigned rather than being guessed as Jayden events.
              </p>
            ) : null}
            {photoSnapshot && photoSnapshot.status !== 'fresh' ? (
              <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                <strong className="block text-sm">Photos snapshot {photoSnapshot.status}</strong>
                <span className="mt-1 block text-sm text-[var(--muted)]">Refresh the local private photo snapshot before using Past Journey memories.</span>
              </div>
            ) : null}
            {photoSetup && photoSetup.state !== 'ready' ? (
              <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                <strong className="block text-sm">{photoSetup.title}</strong>
                <span className="mt-1 block text-sm text-[var(--muted)]">{photoSetup.detail}</span>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            Family schedule source unavailable. No schedule facts are being guessed.
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl overflow-x-auto rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-3" aria-label="This week">
        <div className="grid min-w-[840px] grid-cols-7 gap-px overflow-hidden rounded-2xl bg-[var(--line)]">
          {week.days.map((day) => (
            <div key={day.localDate} className="min-h-[420px] bg-[var(--surface)] p-4" data-today={day.isToday ? 'true' : undefined}>
              <h2 className="text-sm font-medium text-[var(--muted)]">
                {day.weekday} <span className={day.isToday ? 'font-semibold text-[var(--fg,inherit)]' : ''}>{day.dayOfMonth}</span>
              </h2>
              <ul className="mt-3 space-y-2">
                {day.items.map((item) => (
                  <li key={item.id} className="rounded-xl border border-[var(--line)] p-2 text-sm">
                    {item.clock ? <span className="block text-xs text-[var(--muted)]">{item.clock}</span> : null}
                    <span className="block">{item.title}</span>
                  </li>
                ))}
              </ul>
              {day.items.length === 0 ? <p className="mt-3 text-xs text-[var(--muted)]">No scheduled facts.</p> : null}
            </div>
          ))}
        </div>
        <p className="mt-2 px-1 text-xs text-[var(--muted)]">
          {scheduleKnown
            ? `${week.itemCount} scheduled item(s) this week from ${scheduleResult!.source}. Nothing is inferred from titles or guessed.`
            : 'Schedule source unavailable: this week is unknown, not empty.'}
        </p>
      </section>
    </main>
  )
}
