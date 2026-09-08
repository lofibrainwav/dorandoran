import { FamilyOperatingHero } from '@/components/family-operating-hero'
import { privateFamilySurfaceEnabled } from '@/lib/server/private-family-surface'
import { loadPrivateCalendarOperatingPerson } from '@/lib/server/private-calendar-operating-source'
import { loadPrivateCalendarTemporalGrids } from '@/lib/server/private-calendar-temporal-source'
import { loadPrivatePhotoSnapshot } from '@/lib/server/private-photo-snapshot'
import { projectPrivatePhotoSetupGuidance } from '@/lib/server/private-photo-setup-guidance'
import { projectJaydenLearningModule } from '@/lib/server/jayden-specialist-bridge'

export const dynamic = 'force-dynamic'

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const jaydenModules = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'school', label: 'School' },
  { id: 'activities', label: 'Activities' },
  projectJaydenLearningModule({
    parentSessionBound: true,
    capsuleBound: true,
    sameOriginBound: true,
    delegatedBridgeConfigured: false,
  }),
]

export default async function FamilyWeekPage() {
  const privateEnabled = privateFamilySurfaceEnabled()
  const now = new Date()
  const [privateResult, temporalResult, photoSnapshot] = privateEnabled
    ? await Promise.all([
        loadPrivateCalendarOperatingPerson({
          personId: 'person-jayden', label: 'Jayden', now,
          timeZone: 'America/Los_Angeles', modules: jaydenModules,
        }),
        loadPrivateCalendarTemporalGrids({
          personId: 'person-jayden', now, timeZone: 'America/Los_Angeles',
        }),
        loadPrivatePhotoSnapshot({
          now, maxAgeMs: 24 * 60 * 60 * 1000,
        }),
      ])
    : [null, null, null]

  const photoResult = photoSnapshot?.result ?? null
  const photoSetup = projectPrivatePhotoSetupGuidance(photoResult, { albumName: process.env.APPLE_PHOTOS_ALBUM_NAME })

  return (
    <main className="min-h-dvh px-4 py-6 md:px-8">
      <header className="mx-auto mb-6 max-w-7xl">
        <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Family Week</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Jayden-centered coordination</h1>
      </header>

      {privateEnabled ? (
        <section className="mx-auto mb-6 max-w-7xl">
          {privateResult ? (
            <>
              <FamilyOperatingHero
                person={privateResult.readModel}
                monthGrid={temporalResult?.monthGrid}
                yearGrid={temporalResult?.yearGrid}
                journey={photoResult?.experience}
              />
              <p className="mt-2 text-xs text-[var(--muted)]">
                Private local source · today {privateResult.sourceHealth} · temporal {temporalResult?.sourceHealth ?? 'unavailable'}
                {photoSnapshot ? ` · photo snapshot ${photoSnapshot.status}` : ''}
                {photoResult ? ` · photos ${photoResult.sourceHealth}/${photoResult.sourceState}` : ''}
              </p>
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
              Private schedule source unavailable. Family Week remains available.
            </div>
          )}
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl overflow-x-auto rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="grid min-w-[840px] grid-cols-7 gap-px overflow-hidden rounded-2xl bg-[var(--line)]">
          {days.map((day) => (
            <div key={day} className="min-h-[420px] bg-[var(--surface)] p-4">
              <h2 className="text-sm font-medium text-[var(--muted)]">{day}</h2>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
