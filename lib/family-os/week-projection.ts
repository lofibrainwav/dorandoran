import type { FamilyBlock } from './contracts.ts'

export const weekDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export interface WeekBlockProjection {
  blockId: string
  dayIndex: number
  startMinute: number
  endMinute: number
}

function wallParts(value: string): { date: string; minute: number } | null {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
  if (!match) return null
  const hour = Number(match[2])
  const minute = Number(match[3])
  if (hour > 23 || minute > 59) return null
  return { date: match[1], minute: hour * 60 + minute }
}

function utcDateNumber(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const value = Date.parse(`${date}T12:00:00Z`)
  return Number.isFinite(value) ? value : null
}

export function projectWeekBlocks(blocks: FamilyBlock[], weekStartDate: string): WeekBlockProjection[] {
  const weekStart = utcDateNumber(weekStartDate)
  if (weekStart === null) throw new Error('INVALID_WEEK_START')
  return blocks.flatMap((block) => {
    const start = block.reality.start ? wallParts(block.reality.start) : null
    const end = block.reality.end ? wallParts(block.reality.end) : null
    if (!start || !end) return []

    const eventDate = utcDateNumber(start.date)
    if (eventDate === null) return []
    const dayIndex = Math.round((eventDate - weekStart) / 86_400_000)
    if (dayIndex < 0 || dayIndex > 6) return []

    const endMinute = end.date === start.date ? end.minute : Math.max(start.minute + 15, 24 * 60)
    return [{
      blockId: block.id,
      dayIndex,
      startMinute: start.minute,
      endMinute: Math.max(endMinute, start.minute + 15),
    }]
  })
}
