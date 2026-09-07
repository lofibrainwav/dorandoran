export interface LocalCalendarRuntimeConfig {
  clientPath: string
  tokenPath: string
  calendarId: string
}

export interface LocalCalendarSourceConfig extends LocalCalendarRuntimeConfig {
  sourceKey: string
}

export interface LocalCalendarSourceRegistry {
  sources: LocalCalendarSourceConfig[]
  incompleteSourceKeys: string[]
  mode: 'multi' | 'legacy' | 'none'
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function sourceConfig(
  env: Record<string, string | undefined>,
  sourceKey: string,
): LocalCalendarSourceConfig | null {
  const key = sourceKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  const prefix = `GOOGLE_CALENDAR_SOURCE_${key}`
  const clientPath = clean(env[`${prefix}_CLIENT_SECRET_PATH`])
  const tokenPath = clean(env[`${prefix}_TOKEN_PATH`])
  const calendarId = clean(env[`${prefix}_TARGET_ID`])
  if (!clientPath || !tokenPath || !calendarId) return null
  return { sourceKey, clientPath, tokenPath, calendarId }
}

export function resolveLocalCalendarRuntimeConfig(
  env: Record<string, string | undefined>,
): LocalCalendarRuntimeConfig | null {
  const clientPath = clean(env.GOOGLE_CALENDAR_CLIENT_SECRET_PATH)
  const tokenPath = clean(env.GOOGLE_CALENDAR_TOKEN_PATH)
  const calendarId = clean(env.GOOGLE_CALENDAR_TARGET_ID)
  if (!clientPath || !tokenPath || !calendarId) return null
  return { clientPath, tokenPath, calendarId }
}

export function resolveLocalCalendarSourceRegistry(
  env: Record<string, string | undefined>,
): LocalCalendarSourceRegistry {
  const keys = (clean(env.GOOGLE_CALENDAR_SOURCE_KEYS) ?? '')
    .split(',').map((key) => key.trim().toLowerCase()).filter(Boolean)

  if (keys.length) {
    const sources: LocalCalendarSourceConfig[] = []
    const incompleteSourceKeys: string[] = []
    for (const key of keys) {
      const config = sourceConfig(env, key)
      if (config) sources.push(config)
      else incompleteSourceKeys.push(key)
    }
    return { sources, incompleteSourceKeys, mode: 'multi' }
  }

  const legacy = resolveLocalCalendarRuntimeConfig(env)
  if (legacy) {
    return {
      sources: [{ sourceKey: 'family', ...legacy }],
      incompleteSourceKeys: [],
      mode: 'legacy',
    }
  }

  return { sources: [], incompleteSourceKeys: [], mode: 'none' }
}

export function calendarSourceHealth(
  expectedCount: number,
  loadedCount: number,
  failedCount: number,
): 'green' | 'partial' | 'failure' {
  if (expectedCount > 0 && loadedCount === expectedCount && failedCount === 0) return 'green'
  if (loadedCount > 0) return 'partial'
  return 'failure'
}

export interface LocalWeekWindow {
  start: Date
  end: Date
  weekStartDate: string
}
function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function weekWindowFromLocalDate(now: Date): LocalWeekWindow {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())

  const end = new Date(start)
  end.setDate(end.getDate() + 7)

  return {
    start,
    end,
    weekStartDate: localDateKey(start),
  }
}