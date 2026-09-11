export type AppleDigitalAtomSource = 'calendar' | 'reminders' | 'shortcuts' | 'home'
export type AppleDigitalAtomConnectionState = 'connected' | 'stale' | 'unconnected'

export interface AppleDigitalAtomSourceProjection {
  source: AppleDigitalAtomSource
  state: AppleDigitalAtomConnectionState
  eventCount: number
  lastObservedAt: string | null
  cursorUpdatedAt: string | null
}

export interface AppleDigitalAtomProjection {
  status: 'connected' | 'partial' | 'unconnected'
  sources: AppleDigitalAtomSourceProjection[]
}

export type AppleDigitalAtomReadQuery = (text: string, params?: unknown[]) => Promise<{
  rows: Array<Record<string, unknown>>
  rowCount: number | null
}>

const SOURCES: AppleDigitalAtomSource[] = ['calendar', 'reminders', 'shortcuts', 'home']

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null
  return new Date(value).toISOString()
}

function numberOrZero(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : 0
}

export function projectAppleDigitalAtomSources(input: {
  rows: Array<Record<string, unknown>>
  now: Date
  maxAgeMs: number
}): AppleDigitalAtomProjection {
  const sources = SOURCES.map((source) => {
    const row = input.rows.find((candidate) => candidate.source === source)
    const lastObservedAt = isoOrNull(row?.lastObservedAt)
    const cursorUpdatedAt = isoOrNull(row?.cursorUpdatedAt)
    const age = lastObservedAt ? input.now.getTime() - Date.parse(lastObservedAt) : Number.POSITIVE_INFINITY
    const eventCount = numberOrZero(row?.eventCount)
    const state: AppleDigitalAtomConnectionState = eventCount > 0 && age <= input.maxAgeMs ? 'connected' : eventCount > 0 ? 'stale' : 'unconnected'
    return { source, state, eventCount, lastObservedAt, cursorUpdatedAt }
  })
  const connected = sources.filter((source) => source.state === 'connected').length
  return {
    status: connected === SOURCES.length ? 'connected' : connected > 0 ? 'partial' : 'unconnected',
    sources,
  }
}

export async function loadAppleDigitalAtomProjection(input: {
  query: AppleDigitalAtomReadQuery
  now: Date
  maxAgeMs: number
}): Promise<AppleDigitalAtomProjection> {
  const result = await input.query(
    `SELECT s.source,
            COALESCE(m.event_count, 0)::int AS event_count,
            m.last_observed_at,
            c.updated_at AS cursor_updated_at
       FROM unnest(ARRAY['calendar', 'reminders', 'shortcuts', 'home']::text[]) AS s(source)
       LEFT JOIN (
         SELECT source, COUNT(*)::int AS event_count, MAX(observed_at) AS last_observed_at
           FROM apple_digital_atom_metadata
          WHERE deleted_at IS NULL
          GROUP BY source
       ) m ON m.source = s.source
       LEFT JOIN apple_digital_atom_cursor c ON c.source = s.source
      ORDER BY s.source`,
  )
  const rows = result.rows.map((row) => ({
    source: row.source,
    eventCount: row.event_count,
    lastObservedAt: row.last_observed_at,
    cursorUpdatedAt: row.cursor_updated_at,
  }))
  return projectAppleDigitalAtomSources({ rows, now: input.now, maxAgeMs: input.maxAgeMs })
}
