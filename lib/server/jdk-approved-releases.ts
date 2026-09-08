import type { SpecialistModuleSummary } from '../family-os/family-operating-read-model.ts'
import { resolveJdkBridgeConfig } from './jdk-bridge-transport.ts'

export interface ApprovedLearningRelease {
  releaseId: string
  taskId: string
  subject: string
  conceptId: string
  rendererId: string
  approvedAt: string
}

export type JdkApprovedReleasesProbe = 'not_configured' | 'ok' | 'unreachable' | 'unauthorized' | 'invalid'

export interface JdkApprovedReleasesResolution {
  probe: JdkApprovedReleasesProbe
  releases: ApprovedLearningRelease[]
}

export interface JdkBridgeReleasesResponse {
  status: number
  body: string
}

export type JdkBridgeReleasesFetcher = (
  releasesUrl: string,
  token: string | null,
) => Promise<JdkBridgeReleasesResponse>

const RELEASE_TIMEOUT_MS = 2_000
const RELEASE_MAX_BODY_BYTES = 32 * 1024
const RELEASE_MAX_ITEMS = 500
export const RELEASE_CACHE_TTL_MS = 20_000

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
}

export function releasesUrlFromStatusUrl(statusUrl: string): string {
  return new URL('./releases', statusUrl).toString()
}

export function parseJdkApprovedReleasesPayload(payload: unknown): ApprovedLearningRelease[] {
  if (!payload || typeof payload !== 'object') throw new Error('JDK_RELEASES_INVALID')
  const record = payload as Record<string, unknown>
  if (record.ok !== true || !Array.isArray(record.releases) || record.releases.length > RELEASE_MAX_ITEMS) {
    throw new Error('JDK_RELEASES_INVALID')
  }

  return record.releases.map((candidate) => {
    if (!candidate || typeof candidate !== 'object') throw new Error('JDK_RELEASES_INVALID')
    const release = candidate as Record<string, unknown>
    if (
      !nonEmptyString(release.releaseId)
      || !nonEmptyString(release.taskId)
      || !nonEmptyString(release.subject)
      || !nonEmptyString(release.conceptId)
      || !nonEmptyString(release.rendererId)
      || !nonEmptyString(release.approvedAt)
      || !Number.isFinite(Date.parse(release.approvedAt))
    ) {
      throw new Error('JDK_RELEASES_INVALID')
    }
    return {
      releaseId: release.releaseId,
      taskId: release.taskId,
      subject: release.subject,
      conceptId: release.conceptId,
      rendererId: release.rendererId,
      approvedAt: release.approvedAt,
    }
  })
}

async function fetchJdkApprovedReleases(releasesUrl: string, token: string | null): Promise<JdkBridgeReleasesResponse> {
  const response = await fetch(releasesUrl, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(RELEASE_TIMEOUT_MS),
  })
  const body = await response.text()
  return { status: response.status, body }
}

function resolveResponse(response: JdkBridgeReleasesResponse): JdkApprovedReleasesResolution {
  if (response.status === 401 || response.status === 403) return { probe: 'unauthorized', releases: [] }
  if (response.status < 200 || response.status >= 300) return { probe: 'unreachable', releases: [] }
  if (Buffer.byteLength(response.body, 'utf8') > RELEASE_MAX_BODY_BYTES) return { probe: 'invalid', releases: [] }

  let payload: unknown
  try {
    payload = JSON.parse(response.body)
  } catch {
    return { probe: 'invalid', releases: [] }
  }

  try {
    return { probe: 'ok', releases: parseJdkApprovedReleasesPayload(payload) }
  } catch {
    return { probe: 'invalid', releases: [] }
  }
}

const resolutionCache = new Map<string, { expiresAt: number; resolution: JdkApprovedReleasesResolution }>()

export async function loadJdkApprovedReleases(input: {
  env?: Record<string, string | undefined>
  fetchReleases?: JdkBridgeReleasesFetcher
  now?: number
  cacheTtlMs?: number
} = {}): Promise<JdkApprovedReleasesResolution> {
  const env = input.env ?? process.env
  let config
  try {
    config = resolveJdkBridgeConfig(env)
  } catch {
    return { probe: 'invalid', releases: [] }
  }
  if (!config) return { probe: 'not_configured', releases: [] }

  const releasesUrl = releasesUrlFromStatusUrl(config.statusUrl)
  const now = input.now ?? Date.now()
  const ttl = input.cacheTtlMs ?? RELEASE_CACHE_TTL_MS
  const cached = resolutionCache.get(releasesUrl)
  if (cached && cached.expiresAt > now) return cached.resolution

  let resolution: JdkApprovedReleasesResolution
  try {
    const response = await (input.fetchReleases ?? fetchJdkApprovedReleases)(
      releasesUrl,
      clean(env.DORANDORAN_JDK_BRIDGE_TOKEN),
    )
    resolution = resolveResponse(response)
  } catch {
    resolution = { probe: 'unreachable', releases: [] }
  }

  if (ttl > 0) resolutionCache.set(releasesUrl, { expiresAt: now + ttl, resolution })
  return resolution
}

export function projectLearningModuleWithApprovedReleases(
  module: SpecialistModuleSummary,
  releases: JdkApprovedReleasesResolution,
): SpecialistModuleSummary {
  if (module.state !== 'ready') return { ...module, reasonCodes: module.reasonCodes ? [...module.reasonCodes] : undefined }

  switch (releases.probe) {
    case 'ok':
      return {
        ...module,
        statusLabel: `Connected · 승인 릴리즈 ${releases.releases.length}개`,
        reasonCodes: [],
      }
    case 'unauthorized':
      return { ...module, state: 'unknown', statusLabel: 'Bridge unauthorized', reasonCodes: ['DELEGATED_RELEASES_UNAUTHORIZED'] }
    case 'unreachable':
      return { ...module, state: 'unknown', statusLabel: 'Bridge unreachable', reasonCodes: ['DELEGATED_RELEASES_UNREACHABLE'] }
    case 'invalid':
      return { ...module, state: 'unknown', statusLabel: 'Bridge status invalid', reasonCodes: ['DELEGATED_RELEASES_INVALID'] }
    default:
      return { ...module, state: 'blocked', statusLabel: 'Bridge pending', reasonCodes: ['DELEGATED_BRIDGE_MISSING'] }
  }
}
