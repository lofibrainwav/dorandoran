export interface GoogleOAuthClientCredentials {
  clientId: string
  clientSecret: string
}

export interface GoogleHouseholdPreviewEnvInput {
  webClientId: string
  authSecret: string
  membersJson: string
  calendarClientId: string
  calendarClientSecret: string
  calendarRefreshToken: string
  familyCalendarId: string
  subjectRulesJson: string
  responsibilityOverridesJson?: string
}

export interface GoogleHouseholdPreviewEnvEntry {
  key: string
  value: string
  sensitive: boolean
}

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseJsonObject(raw: string, errorCode: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(errorCode)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(errorCode)
  return parsed as Record<string, unknown>
}

export function parseGoogleOAuthClientSecret(raw: string): GoogleOAuthClientCredentials {
  const root = parseJsonObject(raw, 'INVALID_GOOGLE_OAUTH_CLIENT_SECRET')
  const candidate = root.installed ?? root.web
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('INVALID_GOOGLE_OAUTH_CLIENT_SECRET')
  }
  const record = candidate as Record<string, unknown>
  const clientId = clean(record.client_id)
  const clientSecret = clean(record.client_secret)
  if (!clientId || !clientSecret) throw new Error('INVALID_GOOGLE_OAUTH_CLIENT_SECRET')
  return { clientId, clientSecret }
}

/**
 * Accepts both the raw googleapis credential object ({ refresh_token }) and the
 * local token record written by scripts/google-calendar-auth.mjs
 * ({ version, clientId, credentials: { refresh_token } }).
 * When the record carries a clientId and the caller supplies the expected
 * client id, a mismatch is rejected before any remote write happens.
 */
export function parseGoogleOAuthRefreshToken(raw: string, expectedClientId?: string): string {
  const root = parseJsonObject(raw, 'INVALID_GOOGLE_OAUTH_TOKEN')
  const nested = root.credentials
  const credentials =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : root

  const recordClientId = clean(root.clientId)
  const expected = clean(expectedClientId)
  if (recordClientId && expected && recordClientId !== expected) {
    throw new Error('GOOGLE_OAUTH_TOKEN_CLIENT_MISMATCH')
  }

  const refreshToken = clean(credentials.refresh_token)
  if (!refreshToken) throw new Error('MISSING_GOOGLE_REFRESH_TOKEN')
  return refreshToken
}

export function buildGoogleHouseholdPreviewEnv(
  input: GoogleHouseholdPreviewEnvInput,
): GoogleHouseholdPreviewEnvEntry[] {
  const required: Array<[string, string, boolean]> = [
    ['GOOGLE_WEB_CLIENT_ID', input.webClientId, false],
    ['DORANDORAN_AUTH_SECRET', input.authSecret, true],
    ['DORANDORAN_HOUSEHOLD_MEMBERS_JSON', input.membersJson, true],
    ['GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_ID', input.calendarClientId, false],
    ['GOOGLE_HOUSEHOLD_CALENDAR_CLIENT_SECRET', input.calendarClientSecret, true],
    ['GOOGLE_HOUSEHOLD_CALENDAR_REFRESH_TOKEN', input.calendarRefreshToken, true],
    ['DORANDORAN_FAMILY_CALENDAR_ID', input.familyCalendarId, true],
    ['DORANDORAN_CALENDAR_SUBJECT_RULES_JSON', input.subjectRulesJson, true],
  ]

  const entries = required.map(([key, value, sensitive]) => {
    const cleaned = clean(value)
    if (!cleaned) throw new Error(`MISSING_${key}`)
    return { key, value: cleaned, sensitive }
  })

  const responsibilityOverridesJson = clean(input.responsibilityOverridesJson)
  if (responsibilityOverridesJson) {
    entries.push({
      key: 'DORANDORAN_RESPONSIBILITY_OVERRIDES_JSON',
      value: responsibilityOverridesJson,
      sensitive: true,
    })
  }

  return entries
}
