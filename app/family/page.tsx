import { FamilyWeekGrid } from '@/components/family-week-grid'
import { decomposeCalendarEvent, normalizeGoogleCalendarEvent } from '@/lib/family-os'

const weekStartDate = '2026-09-06'
const observedAt = '2026-09-06T12:00:00.000Z'
const context = { calendarId: 'demo-family-calendar', observedAt }

const demoEvents = [
  { id: 'sun-family', summary: 'Family breakfast', start: '2026-09-06T09:00:00-07:00', end: '2026-09-06T10:00:00-07:00' },
  { id: 'tue-music', summary: 'Music lesson', start: '2026-09-08T15:45:00-07:00', end: '2026-09-08T16:15:00-07:00', location: 'Studio' },
  { id: 'wed-study', summary: 'Study session', start: '2026-09-09T15:00:00-07:00', end: '2026-09-09T16:30:00-07:00' },
  { id: 'thu-swim', summary: 'Swim lesson', start: '2026-09-10T18:45:00-07:00', end: '2026-09-10T19:15:00-07:00', location: 'Pool' },
  { id: 'sat-family', summary: 'Community activity', start: '2026-09-12T11:00:00-07:00', end: '2026-09-12T12:00:00-07:00' },
]

const blocks = demoEvents.flatMap((payload) =>
  decomposeCalendarEvent(normalizeGoogleCalendarEvent(payload, context)),
)

export default function FamilyWeekPage() {
  return (
    <main className="min-h-dvh w-screen max-w-[100vw] overflow-x-hidden bg-background px-3 py-5 md:px-6 md:py-8">
      <div className="mx-auto w-full min-w-0 max-w-[1440px] space-y-4">
        <header className="flex w-full min-w-0 flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Chad Family OS</p>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Family Week</h1>
            <p className="mt-1 max-w-full whitespace-normal break-words text-sm text-muted-foreground">Calendar first. Sunday starts the week. Protected events stay protected.</p>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border px-3 py-1.5">Demo data only</span>
            <span className="rounded-full border px-3 py-1.5">Week of Sep 6</span>
          </div>
        </header>

        <p className="text-xs text-muted-foreground md:hidden">Swipe the calendar sideways to see the full week.</p>
        <FamilyWeekGrid blocks={blocks} weekStartDate={weekStartDate} />

        <footer className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>● Confirmed / protected calendar truth</span>
          <span>○ Unknown stays unknown</span>
          <span>Next: replace demo source with authorized live Calendar read.</span>
        </footer>
      </div>
    </main>
  )
}
