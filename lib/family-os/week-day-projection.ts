import type { ContextObservation } from './universal-context.ts'
import { weekWindowFromLocalDate, weekWindowFromLocalWeekStart } from './live-family-week-source.ts'

export interface WeekDayItemProjection {
  id: string
  title: string
  start: string
  end?: string
  clock: string | null
  /** True when the event began before this week and is still running into it. */
  continued: boolean
  /** Calendar-date event (no clock). */
  allDay: boolean
  /** Explicitly resolved people; empty means unassigned, never every household member. */
  subjectIds: string[]
  evidenceRefs: string[]
}

export interface WeekDayProjection {
  localDate: string
  weekday: 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'
  dayOfMonth: number
  isToday: boolean
  items: WeekDayItemProjection[]
}

export interface WeekDaysProjection {
  weekStartDate: string
  timeZone: string
  itemCount: number
  days: WeekDayProjection[]
}

const WEEKDAYS: WeekDayProjection['weekday'][] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function localDateKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

function clockLabel(iso: string, timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
  } catch {
    return null
  }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function validCalendarDate(value: string): boolean {
  const time = Date.parse(value)
  return DATE_ONLY.test(value) && Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

function addDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return next.toISOString().slice(0, 10)
}

/**
 * Sunday-first week of schedule observations, bucketed by the household's local date.
 * An observation is placed on the first local day it overlaps; nothing is inferred beyond its own start/end.
 */
export function projectWeekDays(input: {
  observations: ContextObservation[]
  now: Date
  timeZone: string
  weekStartDate?: string
}): WeekDaysProjection {
  const window = input.weekStartDate
    ? weekWindowFromLocalWeekStart(input.weekStartDate, input.timeZone)
    : weekWindowFromLocalDate(input.now, input.timeZone)
  const windowStartMs = new Date(window.start).getTime()
  const windowEndMs = new Date(window.end).getTime()
  const todayKey = localDateKey(input.now.toISOString(), input.timeZone)
  const buckets = new Map<string, WeekDayItemProjection[]>()

  const weekEndDate = addDays(window.weekStartDate, 7)
  const subjectIdsOf = (observation: ContextObservation) => [...(observation.sixW1H.who?.personIds ?? [])]

  for (const observation of input.observations) {
    const start = observation.sixW1H.when?.start
    const end = observation.sixW1H.when?.end
    if (!start) continue

    if (observation.kind === 'schedule-all-day' || DATE_ONLY.test(start)) {
      // Calendar-date facts are bucketed by their own date; the end date is exclusive.
      if (!validCalendarDate(start) || (end && !validCalendarDate(end))) continue
      const endDate = end ?? addDays(start, 1)
      if (endDate <= start) continue
      if (start >= weekEndDate || endDate <= window.weekStartDate) continue
      const continued = start < window.weekStartDate
      const key = continued ? window.weekStartDate : start
      const list = buckets.get(key) ?? []
      list.push({
        id: observation.id, title: observation.sixW1H.what?.label ?? 'Untitled', start, end: endDate,
        clock: null, continued, allDay: true, subjectIds: subjectIdsOf(observation), evidenceRefs: [...observation.evidenceRefs],
      })
      buckets.set(key, list)
      continue
    }

    const startMs = Date.parse(start)
    if (!Number.isFinite(startMs)) continue
    const endMs = end && Number.isFinite(Date.parse(end)) ? Date.parse(end) : startMs
    if (startMs >= windowEndMs || endMs <= windowStartMs) continue
    const continued = startMs < windowStartMs
    const anchorIso = continued ? new Date(windowStartMs).toISOString() : start
    const key = localDateKey(anchorIso, input.timeZone)
    const list = buckets.get(key) ?? []
    list.push({
      id: observation.id,
      title: observation.sixW1H.what?.label ?? 'Untitled',
      start,
      ...(end ? { end } : {}),
      clock: continued ? null : clockLabel(start, input.timeZone),
      continued,
      allDay: false,
      subjectIds: subjectIdsOf(observation),
      evidenceRefs: [...observation.evidenceRefs],
    })
    buckets.set(key, list)
  }

  const days = WEEKDAYS.map((weekday, index) => {
    const localDate = addDays(window.weekStartDate, index)
    const items = (buckets.get(localDate) ?? []).sort((a, b) =>
      (Number(b.allDay) - Number(a.allDay)) || a.start.localeCompare(b.start))
    return { localDate, weekday, dayOfMonth: Number(localDate.slice(8, 10)), isToday: localDate === todayKey, items }
  })

  return {
    weekStartDate: window.weekStartDate,
    timeZone: input.timeZone,
    itemCount: days.reduce((sum, day) => sum + day.items.length, 0),
    days,
  }
}
