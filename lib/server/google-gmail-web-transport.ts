import { google } from 'googleapis'
import { normalizePrivateGmailMessage, projectPrivateGmailEvidence, type SafeGmailEvidenceProjection } from '../family-os/gmail-private-boundary.ts'
import { planBoundedGmailRead, type BoundedGmailReadPlan } from '../family-os/gmail-live-policy.ts'

export interface GoogleGmailWebRuntimeConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
}

export type GoogleGmailWebRuntimeHealth = 'off' | 'incomplete' | 'ready'

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function rawValues(env: Record<string, string | undefined>) {
  return {
    clientId: clean(env.GOOGLE_HOUSEHOLD_GMAIL_CLIENT_ID),
    clientSecret: clean(env.GOOGLE_HOUSEHOLD_GMAIL_CLIENT_SECRET),
    refreshToken: clean(env.GOOGLE_HOUSEHOLD_GMAIL_REFRESH_TOKEN),
  }
}

export function gmailWebRuntimeHealth(env: Record<string, string | undefined>): GoogleGmailWebRuntimeHealth {
  const values = rawValues(env)
  const inputs = [values.clientId, values.clientSecret, values.refreshToken]
  if (!inputs.some(Boolean)) return 'off'
  return inputs.every(Boolean) ? 'ready' : 'incomplete'
}

export function resolveGoogleGmailWebRuntimeConfig(env: Record<string, string | undefined>): GoogleGmailWebRuntimeConfig | null {
  const health = gmailWebRuntimeHealth(env)
  if (health === 'off') return null
  if (health === 'incomplete') throw new Error('INCOMPLETE_GOOGLE_GMAIL_WEB_CONFIG')
  const values = rawValues(env)
  return { clientId: values.clientId!, clientSecret: values.clientSecret!, refreshToken: values.refreshToken! }
}

/** Reads bounded Gmail metadata and returns only the existing privacy-safe projection. */
export async function readGoogleGmailWebSource(
  config: GoogleGmailWebRuntimeConfig,
  input: BoundedGmailReadPlan,
  observedAt = new Date().toISOString(),
): Promise<SafeGmailEvidenceProjection[]> {
  const plan = planBoundedGmailRead(input)
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret)
  auth.setCredentials({ refresh_token: config.refreshToken })
  const gmail = google.gmail({ version: 'v1', auth })
  const profile = await gmail.users.getProfile({ userId: 'me' })
  const accountId = profile.data.emailAddress?.trim()
  if (!accountId) throw new Error('GMAIL_ACCOUNT_ID_UNOBSERVABLE')
  const listed = await gmail.users.messages.list({
    userId: 'me', q: plan.query, maxResults: plan.maxResults, includeSpamTrash: false,
  })
  const messages: SafeGmailEvidenceProjection[] = []
  for (const item of listed.data.messages ?? []) {
    const messageId = item.id?.trim()
    if (!messageId) continue
    const response = await gmail.users.messages.get({
      userId: 'me', id: messageId, format: 'metadata', metadataHeaders: ['From'],
    })
    const envelope = normalizePrivateGmailMessage({ accountId, observedAt, raw: response.data })
    messages.push(projectPrivateGmailEvidence(envelope, { includeSenderDomain: true }))
  }
  return messages
}
