import { readFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'

import {
  buildGoogleHouseholdPreviewEnv,
  parseGoogleOAuthClientSecret,
  parseGoogleOAuthRefreshToken,
} from '../lib/server/google-household-preview-bootstrap.ts'
import {
  parseCalendarSubjectRules,
  parseHouseholdMembership,
} from '../lib/family-os/google-household-identity.ts'

const BRANCH = 'feature/google-household-identity-v1'
const PROJECT = 'v0-one-box'
const SCOPE = 'hyodo-kingdom'

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`MISSING_${name}`)
  return value
}

function runVercel(args, input) {
  const result = spawnSync('vercel', args, {
    input,
    encoding: 'utf8',
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim()
    throw new Error(`VERCEL_COMMAND_FAILED:${args.slice(0, 3).join(':')}${stderr ? `:${stderr}` : ''}`)
  }
  return result.stdout ?? ''
}

function envAlreadyExists(listing, key) {
  return listing.split(/\r?\n/).some((line) => line.includes(key))
}

const clientPath = requiredEnv('GOOGLE_CALENDAR_CLIENT_SECRET_PATH')
const tokenPath = requiredEnv('GOOGLE_CALENDAR_TOKEN_PATH')
const [clientRaw, tokenRaw] = await Promise.all([
  readFile(clientPath, 'utf8'),
  readFile(tokenPath, 'utf8'),
])

const calendarCredentials = parseGoogleOAuthClientSecret(clientRaw)
const calendarRefreshToken = parseGoogleOAuthRefreshToken(tokenRaw)
const webClientId = requiredEnv('GOOGLE_WEB_CLIENT_ID')
const membersJson = requiredEnv('DORANDORAN_HOUSEHOLD_MEMBERS_JSON')
const familyCalendarId = requiredEnv('DORANDORAN_FAMILY_CALENDAR_ID')
const subjectRulesJson = requiredEnv('DORANDORAN_CALENDAR_SUBJECT_RULES_JSON')
const responsibilityOverridesJson = process.env.DORANDORAN_RESPONSIBILITY_OVERRIDES_JSON?.trim() ?? ''
const authSecret = process.env.DORANDORAN_AUTH_SECRET?.trim() || randomBytes(32).toString('base64url')

// Validate identity and subject routing before any remote write.
parseHouseholdMembership({ DORANDORAN_HOUSEHOLD_MEMBERS_JSON: membersJson })
parseCalendarSubjectRules({ DORANDORAN_CALENDAR_SUBJECT_RULES_JSON: subjectRulesJson })

const entries = buildGoogleHouseholdPreviewEnv({
  webClientId,
  authSecret,
  membersJson,
  calendarClientId: calendarCredentials.clientId,
  calendarClientSecret: calendarCredentials.clientSecret,
  calendarRefreshToken,
  familyCalendarId,
  subjectRulesJson,
  responsibilityOverridesJson,
})

if (process.env.DORANDORAN_PREVIEW_BOOTSTRAP_DRY_RUN === '1') {
  console.log(`[preview-bootstrap] validated ${entries.length} values for ${BRANCH}; no remote writes made`)
  for (const entry of entries) console.log(`[preview-bootstrap] ready ${entry.key}${entry.sensitive ? ' (sensitive)' : ''}`)
  process.exit(0)
}

const commonArgs = ['--scope', SCOPE, '--project', PROJECT]
const listing = runVercel(['env', 'ls', 'preview', BRANCH, ...commonArgs])
const collisions = entries.filter((entry) => envAlreadyExists(listing, entry.key)).map((entry) => entry.key)
if (collisions.length) {
  throw new Error(`PREVIEW_ENV_ALREADY_EXISTS:${collisions.join(',')}`)
}

for (const entry of entries) {
  const args = ['env', 'add', entry.key, 'preview', BRANCH, ...commonArgs]
  if (entry.sensitive) args.push('--sensitive')
  runVercel(args, `${entry.value}\n`)
  console.log(`[preview-bootstrap] added ${entry.key}${entry.sensitive ? ' (sensitive)' : ''}`)
}

console.log(`[preview-bootstrap] configured ${entries.length} branch-scoped Preview values without printing secret contents`)
console.log('[preview-bootstrap] create a fresh Preview deployment before browser E2E')
