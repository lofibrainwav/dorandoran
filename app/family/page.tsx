import { FamilyWeekGrid } from '@/components/family-week-grid'
import {
  decomposeCalendarEvent,
  normalizeGoogleCalendarEvent,
} from '@/lib/family-os'
import { loadLocalFamilyWeek } from '@/lib/server/local-family-calendar'

export const dynamic = 'force-dynamic'

const demoWeekStartDate = '2026-09-06'
const demoContext = {
  calendarId: 'demo-family-calendar',
  observedAt: '2026-09-06T12:00:00.000Z',
}

const demoEvents = [
  { id: 'sun-family', summary: 'Family breakfast', start: '2026-09-06T09:00:00-07:00', end: '2026-09-06T10:00:00-07:00' },
  { id: 'tue-music', summary: 'Music lesson', start: '2026-09-08T15:45:00-07:00', end: '2026-09-08T16:15:00-07:00' },
  { id: 'wed-study', summary: 'Study session', start: '2026-09-09T15:00:00-07:00', end: '2026-09-09T16:30:00-07:00' },
  { id: 'thu-swim', summary: 'Swim lesson', start: '2026-09-10T18:45:00-07:00', end: '2026-09-10T19:15:00-07:00' },
  { id: 'sat-family', summary: 'Community activity', start: '2026-09-12T11:00:00-07:00', end: '2026-09-12T12:00:00-07:00' },
]
const demoBlocks = demoEvents.flatMap((payload) =>
  decomposeCalendarEvent(normalizeGoogleCalendarEvent(payload, demoContext)),
)

export default async function FamilyWeekPage() {
  let live = null
  let liveUnavailable = false

  try {
    live = await loadLocalFamilyWeek()
  } catch {
    liveUnavailable = true
  }

  const blocks = live?.blocks ?? demoBlocks
  const weekStartDate = live?.weekStartDate ?? demoWeekStartDate
  const sourceLabel = live
    ? `Live Calendars · ${live.sourceHealth.toUpperCase()} · ${live.eventCount} events`
    : liveUnavailable
      ? 'Live source unavailable · demo fallback'
      : 'Demo data only'

  return (
    <main className="min-h-dvh w-screen max-w-[100vw] overflow-x-hidden bg-background px-3 py-5 md:px-6 md:py-8">
      <div className="mx-auto w-full min-w-0 max-w-[1440px] space-y-4">
        <header className="flex w-full min-w-0 flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Chad Family OS</p>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Family Week</h1>
            <p className="mt-1 max-w-full whitespace-normal break-words text-sm text-muted-foreground">
              Calendar first. Sunday starts the week. Protected events stay protected.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border px-3 py-1.5">{sourceLabel}</span>
            <span className="rounded-full border px-3 py-1.5">Week of {weekStartDate}</span>
          </div>
        </header>

        <p className="text-xs text-muted-foreground md:hidden">Swipe the calendar sideways to see the full week.</p>
        <FamilyWeekGrid blocks={blocks} weekStartDate={weekStartDate} insights={live?.insights ?? []} />
        <footer className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>● Confirmed / protected calendar truth</span>
          <span>○ Unknown stays unknown</span>
          <span>{live ? `Sources: ${live.loadedSourceKeys.length} loaded / ${live.failedSourceKeys.length} unavailable` : 'Public-safe demo fallback active.'}</span>
        </footer>
      </div>
    </main>
  )
}
