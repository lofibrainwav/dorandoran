export interface GoogleSourceTokenRecord {
  services?: unknown
  scopes?: unknown
}

export function assertGoogleTokenServices(
  token: GoogleSourceTokenRecord,
  requiredServices: Array<'calendar' | 'gmail'>,
): void {
  const services = Array.isArray(token.services)
    ? token.services.filter((value): value is string => typeof value === 'string')
    : []
  const scopes = Array.isArray(token.scopes)
    ? token.scopes.filter((value): value is string => typeof value === 'string')
    : []

  for (const service of requiredServices) {
    if (!services.includes(service)) {
      throw new Error(`GOOGLE_TOKEN_SERVICE_MISSING:${service}`)
    }
    const expected = service === 'calendar'
      ? 'https://www.googleapis.com/auth/calendar.readonly'
      : 'https://www.googleapis.com/auth/gmail.readonly'
    if (!scopes.includes(expected)) {
      throw new Error(`GOOGLE_TOKEN_SCOPE_MISSING:${service}`)
    }
  }
}

export interface BoundedGmailReadPlan {
  query: string
  maxResults: number
}

export function planBoundedGmailRead(input: {
  query: string
  maxResults: number
}): BoundedGmailReadPlan {
  const query = input.query.trim()
  if (!query) throw new Error('GMAIL_QUERY_REQUIRED')
  if (!Number.isInteger(input.maxResults) || input.maxResults < 1 || input.maxResults > 50) {
    throw new Error('GMAIL_MAX_RESULTS_OUT_OF_RANGE')
  }
  return { query, maxResults: input.maxResults }
}
