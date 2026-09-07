import type { ContextObservation } from './universal-context.ts'

export type TemporalGridScale = 'month' | 'year'

export interface TemporalGridCell {
  id: string
  label: string
  inScope: boolean
  dateKey?: string
  monthKey?: string
  observationCount: number
  evidenceRefs: string[]
}

export interface TemporalGridProjection {
  scale: TemporalGridScale
  anchorLocalDate: string
  timeZone: string
  cells: TemporalGridCell[]
}

export type TemporalGridDisplayCell = Omit<TemporalGridCell, 'evidenceRefs'>
export interface TemporalGridDisplayProjection {
  scale: TemporalGridScale
  anchorLocalDate: string
  cells: TemporalGridDisplayCell[]
}

export interface ProjectTemporalGridInput {
  scale: TemporalGridScale
  anchorLocalDate: string
  timeZone: string
  observations: ContextObservation[]
  subjectId?: string
}
interface DateParts { year: number; month: number; day: number }

function parseLocalDate(value: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('VALID_LOCAL_DATE_REQUIRED')
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  if (
    check.getUTCFullYear() !== parts.year
    || check.getUTCMonth() + 1 !== parts.month
    || check.getUTCDate() !== parts.day
  ) throw new Error('VALID_LOCAL_DATE_REQUIRED')
  return parts
}

function dateKey(parts: DateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function monthKey(parts: DateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`
}

function zonedParts(iso: string, timeZone: string): DateParts | null {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return null
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const values = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) }
}

function relevantObservations(input: ProjectTemporalGridInput): ContextObservation[] {
  return input.observations.filter((observation) => {
    if (input.subjectId && !observation.sixW1H.who?.personIds.includes(input.subjectId)) return false
    return Boolean(observation.sixW1H.when?.start)
  })
}

function evidenceFor(observations: ContextObservation[]): string[] {
  return [...new Set(observations.flatMap((observation) => observation.evidenceRefs).filter(Boolean))]
}

function monthCells(input: ProjectTemporalGridInput, anchor: DateParts): TemporalGridCell[] {
  const first = new Date(Date.UTC(anchor.year, anchor.month - 1, 1))
  const gridStart = new Date(first)
  gridStart.setUTCDate(1 - first.getUTCDay())
  const observations = relevantObservations(input)
  return Array.from({ length: 42 }, (_, index) => {
    const cursor = new Date(gridStart)
    cursor.setUTCDate(gridStart.getUTCDate() + index)
    const parts = { year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1, day: cursor.getUTCDate() }
    const key = dateKey(parts)
    const matching = observations.filter((observation) => {
      const start = observation.sixW1H.when?.start
      const local = start ? zonedParts(start, input.timeZone) : null
      return local ? dateKey(local) === key : false
    })
    return {
      id: `day:${key}`,
      label: String(parts.day),
      inScope: parts.year === anchor.year && parts.month === anchor.month,
      dateKey: key,
      monthKey: monthKey(parts),
      observationCount: matching.length,
      evidenceRefs: evidenceFor(matching),
    }
  })
}

function yearCells(input: ProjectTemporalGridInput, anchor: DateParts): TemporalGridCell[] {
  const observations = relevantObservations(input)
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const key = `${anchor.year}-${String(month).padStart(2, '0')}`
    const matching = observations.filter((observation) => {
      const start = observation.sixW1H.when?.start
      const local = start ? zonedParts(start, input.timeZone) : null
      return local ? monthKey(local) === key : false
    })
    return {
      id: `month:${key}`,
      label: monthFormatter.format(new Date(Date.UTC(anchor.year, index, 1))),
      inScope: true,
      monthKey: key,
      observationCount: matching.length,
      evidenceRefs: evidenceFor(matching),
    }
  })
}

export function projectTemporalGrid(input: ProjectTemporalGridInput): TemporalGridProjection {
  const anchor = parseLocalDate(input.anchorLocalDate)
  const timeZone = input.timeZone.trim()
  if (!timeZone) throw new Error('TIME_ZONE_REQUIRED')
  // Force IANA validation before projecting any observation.
  new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0))

  return {
    scale: input.scale,
    anchorLocalDate: input.anchorLocalDate,
    timeZone,
    cells: input.scale === 'month' ? monthCells(input, anchor) : yearCells(input, anchor),
  }
}

export function temporalGridForDisplay(grid: TemporalGridProjection): TemporalGridDisplayProjection {
  return {
    scale: grid.scale,
    anchorLocalDate: grid.anchorLocalDate,
    cells: grid.cells.map((cell) => ({
      id: cell.id,
      label: cell.label,
      inScope: cell.inScope,
      ...(cell.dateKey ? { dateKey: cell.dateKey } : {}),
      ...(cell.monthKey ? { monthKey: cell.monthKey } : {}),
      observationCount: cell.observationCount,
    })),
  }
}
