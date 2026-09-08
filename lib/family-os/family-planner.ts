import type { ContextObservation } from './universal-context.ts'
import { weekWindowFromLocalDate } from './live-family-week-source.ts'

export const DAY_PERIODS = [
  { id: 'morning', label: '아침', english: 'Morning', start: 360, end: 720, icon: '☀' },
  { id: 'midday', label: '낮', english: 'Midday', start: 720, end: 900, icon: '◒' },
  { id: 'afternoon', label: '오후', english: 'Afternoon', start: 900, end: 1080, icon: '◐' },
  { id: 'evening', label: '저녁', english: 'Evening', start: 1080, end: 1260, icon: '☾' },
] as const

export type PlannerEvent = {
  id: string; title: string; date: string; startMinute: number; endMinute: number;
  allDay: boolean; continued: boolean; owner: 'child' | 'adult' | 'family'; place?: string
}
export type PlannerGap = { id: string; date: string; startMinute: number; endMinute: number; minutes: number }
export type PlannerDay = {
  date: string; weekday: string; dayNumber: number; today: boolean; past: boolean;
  events: PlannerEvent[]; gaps: PlannerGap[]; notices: Array<{ kind: 'overlap' | 'tight'; minutes: number }>
}
export type FamilyPlannerModel = { weekStart: string; timeZone: string; known: boolean; eventCount: number; days: PlannerDay[] }

function localParts(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso))
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { date: `${value('year')}-${value('month')}-${value('day')}`, minute: Number(value('hour')) * 60 + Number(value('minute')) }
}

export function minuteClock(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

/** Calendar gaps are opportunities to discuss, never proof that every person is available. */
export function buildFamilyPlanner(input: { observations: ContextObservation[]; now: Date; timeZone: string; known: boolean; childPersonId: string | null }): FamilyPlannerModel {
  const { weekStartDate } = weekWindowFromLocalDate(input.now, input.timeZone)
  const today = localParts(input.now.toISOString(), input.timeZone)
  const seen = new Set<string>()
  const days = Array.from({ length: 7 }, (_, index): PlannerDay => {
    const day = new Date(`${weekStartDate}T12:00:00Z`)
    day.setUTCDate(day.getUTCDate() + index)
    const date = day.toISOString().slice(0, 10)
    const events: PlannerEvent[] = []
    if (input.known) input.observations.forEach((observation, eventIndex) => {
      if (!['schedule', 'schedule-all-day'].includes(observation.kind) || observation.evidenceState !== 'confirmed') return
      const when = observation.sixW1H.when
      if (!when?.start || !when.end || !Number.isFinite(Date.parse(when.start)) || !Number.isFinite(Date.parse(when.end)) || Date.parse(when.end) <= Date.parse(when.start)) return
      const allDay = /^\d{4}-\d{2}-\d{2}$/.test(when.start)
      const start = allDay ? { date: when.start, minute: 0 } : localParts(when.start, input.timeZone)
      const end = allDay ? { date: when.end, minute: 0 } : localParts(when.end, input.timeZone)
      if (start.date > date || end.date < date || (end.date === date && end.minute === 0)) return
      const subjects = observation.sixW1H.who?.personIds ?? []
      const owner = subjects.includes(input.childPersonId ?? '') ? 'child' : subjects.length ? 'adult' : 'family'
      const id = `item-${eventIndex}`
      seen.add(id)
      events.push({ id, title: observation.sixW1H.what?.label ?? '제목 없는 일정', date,
        startMinute: start.date < date ? 0 : start.minute, endMinute: end.date > date ? 1440 : end.minute,
        allDay, continued: start.date < date, owner,
        ...(observation.sixW1H.where?.label ? { place: observation.sixW1H.where.label } : {}),
      })
    })
    events.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startMinute - b.startMinute)
    const timed = events.filter((event) => !event.allDay)
    const notices: PlannerDay['notices'] = []
    let priorEnd: number | null = null
    for (const event of timed) {
      if (priorEnd !== null) {
        const gap = event.startMinute - priorEnd
        if (gap < 0) notices.push({ kind: 'overlap', minutes: -gap })
        else if (gap < 30) notices.push({ kind: 'tight', minutes: gap })
      }
      priorEnd = Math.max(priorEnd ?? 0, event.endMinute)
    }
    const gaps: PlannerGap[] = []
    // All-day facts may represent availability constraints. Do not advertise those days as free.
    if (input.known && date >= today.date && !events.some((event) => event.allDay)) {
      for (const period of DAY_PERIODS) {
        let cursor = Math.max(period.start, date === today.date ? Math.ceil(today.minute / 15) * 15 : 0)
        for (const event of timed) {
          const from = Math.max(period.start, event.startMinute - 15)
          const until = Math.min(period.end, event.endMinute + 15)
          if (until <= cursor || from >= period.end) continue
          if (from - cursor >= 30) gaps.push({ id: `${date}-${cursor}`, date, startMinute: cursor, endMinute: from, minutes: from - cursor })
          cursor = Math.max(cursor, until)
        }
        if (period.end - cursor >= 30) gaps.push({ id: `${date}-${cursor}`, date, startMinute: cursor, endMinute: period.end, minutes: period.end - cursor })
      }
    }
    return { date, weekday: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][index], dayNumber: day.getUTCDate(), today: date === today.date, past: date < today.date, events, gaps, notices }
  })
  return { weekStart: weekStartDate, timeZone: input.timeZone, known: input.known, eventCount: seen.size, days }
}

export type PlannedTimebox = { id: string; title: string; date: string; startMinute: number; minutes: number; owner: string }

export type PlannerWish = { id: string; title: string; minutes: number; estimated: boolean; required: boolean; owner: string }

/** One line per wish. Unspecified durations are visible estimates, editable before scheduling. */
export function parsePlannerMemo(memo: string): PlannerWish[] {
  return memo.split('\n').map((line) => line.trim().replace(/^[-*•]\s*/, '')).filter(Boolean).slice(0, 50).map((line, index) => {
    const duration = /(?:(\d+(?:\.\d+)?)\s*(?:시간|hours?|hr)\s*)?(?:(\d+)\s*(?:분|minutes?|mins?))?/i
    // Avoid the all-optional regex matching an empty prefix.
    const explicit = line.match(/\d+(?:\.\d+)?\s*(?:시간|hours?|hr)(?:\s*\d+\s*(?:분|minutes?|mins?))?|\d+\s*(?:분|minutes?|mins?)/i)?.[0]
    const parts = explicit?.match(duration)
    const minutes = parts ? Math.round(Number(parts[1] ?? 0) * 60 + Number(parts[2] ?? 0)) : 30
    const owner = line.match(/@(Julie|Jayden|Jay|Chad|Together|쥴리|제이든|제이|함께)(?=\s|$|[,;])/i)?.[1] ?? '함께'
    return { id: `wish-${index}`, title: line, minutes, estimated: !explicit, required: /해야|필수|마감|must|!/i.test(line), owner }
  })
}

export function schedulePlannerWishes(wishes: PlannerWish[], model: FamilyPlannerModel, existing: PlannedTimebox[] = []): { plans: PlannedTimebox[]; unplaced: PlannerWish[] } {
  const plans: PlannedTimebox[] = []
  const unplaced: PlannerWish[] = []
  const gaps = model.known ? model.days.flatMap((day) => day.gaps) : []
  for (const wish of [...wishes].sort((a, b) => Number(b.required) - Number(a.required))) {
    let placed = false
    for (const gap of gaps) {
      let start = gap.startMinute
      const occupied = [...existing, ...plans].filter((plan) => plan.date === gap.date).sort((a, b) => a.startMinute - b.startMinute)
      for (const plan of occupied) {
        if (plan.startMinute + plan.minutes + 10 <= start) continue
        if (start + wish.minutes + 10 <= plan.startMinute) break
        start = Math.max(start, plan.startMinute + plan.minutes + 10)
      }
      if (start + wish.minutes > gap.endMinute || !Number.isFinite(wish.minutes) || wish.minutes <= 0) continue
      plans.push({ id: `draft-${wish.id}-${gap.date}-${start}`, title: wish.title, date: gap.date, startMinute: start, minutes: wish.minutes, owner: wish.owner })
      placed = true
      break
    }
    if (!placed) unplaced.push(wish)
  }
  return { plans, unplaced }
}

export function canPlaceTimebox(gap: PlannerGap, minutes: number, plans: PlannedTimebox[]): boolean {
  return Number.isInteger(minutes) && minutes > 0 && minutes <= gap.minutes && !plans.some((plan) => plan.date === gap.date && plan.startMinute < gap.startMinute + minutes && plan.startMinute + plan.minutes > gap.startMinute)
}

/** User-selected drafts only. Importing this file is an explicit action in Google/Apple Calendar. */
export function exportTimeboxes(plans: PlannedTimebox[], timeZone: string): string {
  if (!/^[A-Za-z0-9_+/-]+$/.test(timeZone)) throw new Error('INVALID_TIME_ZONE')
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&')
  const dateTime = (date: string, minute: number) => `${date.replaceAll('-', '')}T${minuteClock(minute).replace(':', '')}00`
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DoranDoran//Family Planner//KO', 'CALSCALE:GREGORIAN', ...plans.flatMap((plan) => [
    'BEGIN:VEVENT', `UID:${escape(plan.id)}@dorandoran.link`, `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${timeZone}:${dateTime(plan.date, plan.startMinute)}`,
    `DTEND;TZID=${timeZone}:${dateTime(plan.date, plan.startMinute + plan.minutes)}`,
    `SUMMARY:${escape(plan.title)}`, `DESCRIPTION:${escape(`${plan.owner} · Family OS에서 선택한 계획`)}`, 'END:VEVENT',
  ]), 'END:VCALENDAR', ''].join('\r\n')
}
