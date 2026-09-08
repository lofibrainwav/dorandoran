export const DEFAULT_HOUSEHOLD_TIME_ZONE = 'America/Los_Angeles'

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0))
    return true
  } catch {
    return false
  }
}

/** The household's home IANA time zone. Env-driven so a move never requires a code change. */
export function resolveHouseholdTimeZone(env: Record<string, string | undefined> = process.env): string {
  const raw = env.DORANDORAN_TIME_ZONE?.trim()
  if (!raw) return DEFAULT_HOUSEHOLD_TIME_ZONE
  if (!validTimeZone(raw)) throw new Error('INVALID_HOUSEHOLD_TIME_ZONE')
  return raw
}
