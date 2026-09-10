#!/usr/bin/env node
/**
 * Gmail read-only live smoke.
 *
 * This intentionally reads only profile metadata and bounded message metadata.
 * It never prints an address, subject, sender, snippet, body, or message id.
 *
 * Usage:
 *   node --env-file=.env.local scripts/google-gmail-smoke.mjs --query="newer_than:7d" --max-results=10
 */
import { google } from 'googleapis'

import {
  normalizePrivateGmailMessage,
  projectPrivateGmailEvidence,
} from '../lib/family-os/gmail-private-boundary.ts'
import { planBoundedGmailRead } from '../lib/family-os/gmail-live-policy.ts'
import { resolveGoogleGmailWebRuntimeConfig } from '../lib/server/google-gmail-web-transport.ts'

function flag(name, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  const value = found?.split('=').slice(1).join('=').trim()
  return value || fallback
}

const plan = planBoundedGmailRead({
  query: flag('query', ''),
  maxResults: Number(flag('max-results', '10')),
})
const config = resolveGoogleGmailWebRuntimeConfig(process.env)
if (!config) throw new Error('GOOGLE_GMAIL_RUNTIME_CONFIG_MISSING')

const auth = new google.auth.OAuth2(config.clientId, config.clientSecret)
auth.setCredentials({ refresh_token: config.refreshToken })
const gmail = google.gmail({ version: 'v1', auth })
const profile = await gmail.users.getProfile({ userId: 'me' })
const account = profile.data.emailAddress?.trim()
if (!account) throw new Error('GMAIL_ACCOUNT_ID_UNOBSERVABLE')

const listed = await gmail.users.messages.list({
  userId: 'me',
  q: plan.query,
  maxResults: plan.maxResults,
  includeSpamTrash: false,
})

let normalizedCount = 0
let invalidCount = 0
const observedAt = new Date().toISOString()
for (const item of listed.data.messages ?? []) {
  const messageId = item.id?.trim()
  if (!messageId) continue
  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: ['From'],
    })
    const envelope = normalizePrivateGmailMessage({ accountId: account, raw: response.data, observedAt })
    projectPrivateGmailEvidence(envelope, { includeSenderDomain: true })
    normalizedCount += 1
  } catch {
    invalidCount += 1
  }
}

if (invalidCount > 0) throw new Error('GOOGLE_GMAIL_LIVE_SMOKE_FAILED')
const domain = account.includes('@') ? account.split('@').at(-1) : '(unknown)'
console.log('GMAIL_LIVE_READ_OK')
console.log(`ACCOUNT_DOMAIN=${domain}`)
console.log(`MESSAGE_COUNT=${listed.data.messages?.length ?? 0}`)
console.log(`NORMALIZED_COUNT=${normalizedCount}`)
console.log('No email addresses, subjects, senders, snippets, bodies, or message ids were printed.')
