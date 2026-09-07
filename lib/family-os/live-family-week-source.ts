export interface LocalCalendarRuntimeConfig {
  clientPath: string
  tokenPath: string
  calendarId: string
}

export function resolveLocalCalendarRuntimeConfig(
  env: Record<string, string | undefined>,
): LocalCalendarRuntimeConfig | null {
  const clientPath = env.GOOGLE_CALENDAR_CLIENT_SECRET_PATH?.trim()
  const tokenPath = env.GOOGLE_CALENDAR_TOKEN_PATH?.trim()
  const calendarId = env.GOOGLE_CALENDAR_TARGET_ID?.trim()

  if (!clientPath || !tokenPath || !calendarId) return null
  return { clientPath, tokenPath, calendarId }
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
