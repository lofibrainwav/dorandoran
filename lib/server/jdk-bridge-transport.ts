import {
  evaluateJdkReleaseTransport,
  type JdkReleaseTransportDecision,
} from '../family-os/jdk-exact-bridge.ts'
import type { SpecialistModuleSummary } from '../family-os/family-operating-read-model.ts'

/**
 * Delegated JDK bridge: Family OS never talks to the parent-bound release endpoint directly.
 * It only reads a status projection from a bridge the operator has explicitly configured.
 *
 * Contract (GET `${DORANDORAN_JDK_BRIDGE_URL}/status`, optional bearer DORANDORAN_JDK_BRIDGE_TOKEN):
 *   { "parentSessionBound": boolean, "capsuleBound": boolean, "sameOriginBound": boolean }
 */
export interface JdkBridgeConfig {
  statusUrl: string
  hasToken: boolean
}

export interface JdkBridgeStatus {
  parentSessionBound: boolean
  capsuleBound: boolean
  sameOriginBound: boolean
}

export type JdkBridgeProbe = 'not_configured' | 'ok' | 'unreachable' | 'unauthorized' | 'invalid'

export interface JdkReleaseTransportResolution {
  probe: JdkBridgeProbe
  decision: JdkReleaseTransportDecision
}

/** Raw transport result; a thrown error means the bridge could not be reached at all. */
export interface JdkBridgeStatusResponse {
  status: number
  body: string
}

export type JdkBridgeStatusFetcher = (config: JdkBridgeConfig, token: string | null) => Promise<JdkBridgeStatusResponse>

const STATUS_TIMEOUT_MS = 2_000
const STATUS_MAX_BODY_BYTES = 4_096
export const STATUS_CACHE_TTL_MS = 20_000

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function resolveJdkBridgeConfig(env: Record<string, string | undefined> = process.env): JdkBridgeConfig | null {
  const raw = clean(env.DORANDORAN_JDK_BRIDGE_URL)
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('JDK_BRIDGE_URL_INVALID')
  }
  if (url.protocol !== 'https:') throw new Error('JDK_BRIDGE_URL_INVALID')
  const base = url.toString().replace(/\/+$/, '')
  return { statusUrl: `${base}/status`, hasToken: Boolean(clean(env.DORANDORAN_JDK_BRIDGE_TOKEN)) }
}

export function parseJdkBridgeStatus(payload: unknown): JdkBridgeStatus {
  if (!payload || typeof payload !== 'object') throw new Error('JDK_BRIDGE_STATUS_INVALID')
  const record = payload as Record<string, unknown>
  const keys = ['parentSessionBound', 'capsuleBound', 'sameOriginBound'] as const
  for (const key of keys) {
    if (typeof record[key] !== 'boolean') throw new Error('JDK_BRIDGE_STATUS_INVALID')
  }
  return {
    parentSessionBound: record.parentSessionBound as boolean,
    capsuleBound: record.capsuleBound as boolean,
    sameOriginBound: record.sameOriginBound as boolean,
  }
}

async function fetchJdkBridgeStatus(config: JdkBridgeConfig, token: string | null): Promise<JdkBridgeStatusResponse> {
  const response = await fetch(config.statusUrl, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
    // A redirecting bridge is an unknown bridge: fail closed instead of following it anywhere.
    redirect: 'error',
    signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
  })
  const body = await response.text()
  return { status: response.status, body }
}

function blocked(reason: string): JdkReleaseTransportDecision {
  return { state: 'blocked_pending_transport', reasons: [reason] }
}

function resolveFromResponse(response: JdkBridgeStatusResponse): JdkReleaseTransportResolution {
  if (response.status === 401 || response.status === 403) {
    return { probe: 'unauthorized', decision: blocked('DELEGATED_BRIDGE_UNAUTHORIZED') }
  }
  if (response.status < 200 || response.status >= 300) {
    return { probe: 'unreachable', decision: blocked('DELEGATED_BRIDGE_UNREACHABLE') }
  }
  if (Buffer.byteLength(response.body, 'utf8') > STATUS_MAX_BODY_BYTES) {
    return { probe: 'invalid', decision: blocked('DELEGATED_BRIDGE_STATUS_INVALID') }
  }
  let payload: unknown
  try {
    payload = JSON.parse(response.body)
  } catch {
    return { probe: 'invalid', decision: blocked('DELEGATED_BRIDGE_STATUS_INVALID') }
  }
  let status: JdkBridgeStatus
  try {
    status = parseJdkBridgeStatus(payload)
  } catch {
    return { probe: 'invalid', decision: blocked('DELEGATED_BRIDGE_STATUS_INVALID') }
  }
  return { probe: 'ok', decision: evaluateJdkReleaseTransport({ ...status, delegatedBridgeConfigured: true }) }
}

const resolutionCache = new Map<string, { expiresAt: number; resolution: JdkReleaseTransportResolution }>()

export async function resolveJdkReleaseTransport(input: {
  env?: Record<string, string | undefined>
  fetchStatus?: JdkBridgeStatusFetcher
  now?: number
  cacheTtlMs?: number
} = {}): Promise<JdkReleaseTransportResolution> {
  const env = input.env ?? process.env
  let config: JdkBridgeConfig | null
  try {
    config = resolveJdkBridgeConfig(env)
  } catch {
    return { probe: 'invalid', decision: blocked('DELEGATED_BRIDGE_CONFIG_INVALID') }
  }
  if (!config) return { probe: 'not_configured', decision: blocked('DELEGATED_BRIDGE_MISSING') }

  const now = input.now ?? Date.now()
  const ttl = input.cacheTtlMs ?? STATUS_CACHE_TTL_MS
  const cached = resolutionCache.get(config.statusUrl)
  if (cached && cached.expiresAt > now) return cached.resolution

  let resolution: JdkReleaseTransportResolution
  try {
    const response = await (input.fetchStatus ?? fetchJdkBridgeStatus)(config, clean(env.DORANDORAN_JDK_BRIDGE_TOKEN))
    resolution = resolveFromResponse(response)
  } catch {
    resolution = { probe: 'unreachable', decision: blocked('DELEGATED_BRIDGE_UNREACHABLE') }
  }
  if (ttl > 0) resolutionCache.set(config.statusUrl, { expiresAt: now + ttl, resolution })
  return resolution
}

export function projectJaydenLearningModuleFromResolution(resolution: JdkReleaseTransportResolution): SpecialistModuleSummary {
  const reasonCodes = [...resolution.decision.reasons]
  if (resolution.decision.state === 'ready') {
    return { id: 'learning', label: 'Learning', state: 'ready', statusLabel: 'Connected', reasonCodes: [] }
  }
  switch (resolution.probe) {
    case 'unreachable':
      return { id: 'learning', label: 'Learning', state: 'unknown', statusLabel: 'Bridge unreachable', reasonCodes }
    case 'unauthorized':
      return { id: 'learning', label: 'Learning', state: 'unknown', statusLabel: 'Bridge unauthorized', reasonCodes }
    case 'invalid':
      return { id: 'learning', label: 'Learning', state: 'unknown', statusLabel: 'Bridge status invalid', reasonCodes }
    default:
      return { id: 'learning', label: 'Learning', state: 'blocked', statusLabel: 'Bridge pending', reasonCodes }
  }
}

export async function loadJaydenLearningModule(input: Parameters<typeof resolveJdkReleaseTransport>[0] = {}): Promise<SpecialistModuleSummary> {
  return projectJaydenLearningModuleFromResolution(await resolveJdkReleaseTransport(input))
}
