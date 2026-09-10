export type GoogleAuthMintTarget = {
  service: 'drive' | 'gmail'
  clientIdEnv: string
  clientSecretEnv: string
  refreshTokenEnv: string
  defaultOut: string
}

/**
 * Resolve one least-privilege Google read-only mint target.
 * A token is stored under the service it was minted for; mixed scopes are
 * refused so a Gmail environment variable cannot accidentally carry Drive
 * authority (or the reverse).
 */
export function resolveGoogleAuthMintTarget(services: string[]): GoogleAuthMintTarget {
  const normalized = [...new Set(services.map((service) => service.trim().toLowerCase()).filter(Boolean))]
  if (normalized.length !== 1 || !['drive', 'gmail'].includes(normalized[0] ?? '')) {
    throw new Error('GOOGLE_AUTH_MINT_ONE_SERVICE_REQUIRED — choose exactly one of: drive, gmail')
  }

  if (normalized[0] === 'gmail') {
    return {
      service: 'gmail',
      clientIdEnv: 'GOOGLE_HOUSEHOLD_GMAIL_CLIENT_ID',
      clientSecretEnv: 'GOOGLE_HOUSEHOLD_GMAIL_CLIENT_SECRET',
      refreshTokenEnv: 'GOOGLE_HOUSEHOLD_GMAIL_REFRESH_TOKEN',
      defaultOut: '.env.gmail',
    }
  }

  return {
    service: 'drive',
    clientIdEnv: 'DRIVE_OUTBOX_CLIENT_ID',
    clientSecretEnv: 'DRIVE_OUTBOX_CLIENT_SECRET',
    refreshTokenEnv: 'DRIVE_OUTBOX_REFRESH_TOKEN',
    defaultOut: '.env.drive-outbox',
  }
}
