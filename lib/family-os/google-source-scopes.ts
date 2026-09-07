export type GoogleReadOnlyService = 'calendar' | 'gmail'

const SCOPES: Record<GoogleReadOnlyService, string> = {
  calendar: 'https://www.googleapis.com/auth/calendar.readonly',
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
}

export function resolveGoogleReadOnlyScopes(services: string[]): string[] {
  const unique: GoogleReadOnlyService[] = []
  for (const raw of services) {
    const service = raw.trim().toLowerCase()
    if (!service) continue
    if (service !== 'calendar' && service !== 'gmail') {
      throw new Error(`GOOGLE_SOURCE_SERVICE_UNSUPPORTED:${service}`)
    }
    if (!unique.includes(service)) unique.push(service)
  }
  if (unique.length === 0) throw new Error('GOOGLE_SOURCE_SERVICE_REQUIRED')
  return unique.map((service) => SCOPES[service])
}
