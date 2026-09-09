import type { NextRequest } from 'next/server'
import { parseHouseholdMembership } from '../family-os/google-household-identity.ts'
import type { HouseholdMember } from '../family-os/google-household-identity.ts'
import { createLifecycleService, type LifecycleService } from './lifecycle-service.ts'
import { createLifecycleStoreFromEnv, type LifecycleStore } from './lifecycle-store.ts'
import { HOUSEHOLD_SESSION_COOKIE, resolveHouseholdSessionMember } from './google-household-session.ts'

let cachedStore: LifecycleStore | null = null
let storeOverride: LifecycleStore | null | undefined

/** Test-only seam: makes route tests inject the in-memory fake instead of ever touching a real
 * DB. Pass `null` to force `LIFECYCLE_STORE_UNAVAILABLE`; call with no override (or omit the call)
 * to fall back to the env-derived singleton.
 *
 * Guarded by `NODE_ENV`: refuses to run at all when it is `'production'`, so this hook can never
 * be reached by a real deployment even if something imported it by mistake — a route test must
 * set `process.env.NODE_ENV = 'test'` (or otherwise not-production) before calling it. */
export function __setLifecycleStoreForTests(store: LifecycleStore | null): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('LIFECYCLE_TEST_HOOK_FORBIDDEN_IN_PRODUCTION')
  }
  storeOverride = store
}

function resolveStore(): LifecycleStore | null {
  if (storeOverride !== undefined) return storeOverride
  if (!cachedStore) {
    cachedStore = createLifecycleStoreFromEnv({
      DATABASE_URL: process.env.DATABASE_URL,
      POSTGRES_URL: process.env.POSTGRES_URL,
    })
  }
  return cachedStore
}

export type LifecycleContext =
  | { viewer: HouseholdMember; service: LifecycleService }
  | { error: 'AUTH_REQUIRED' | 'LIFECYCLE_STORE_UNAVAILABLE' }

/** Resolves everything a lifecycle route needs from a request: the household session (fails
 * closed to `AUTH_REQUIRED` with no cookie, an expired/invalid token, or a member who cannot sign
 * in) and the persistence store (fails closed to `LIFECYCLE_STORE_UNAVAILABLE` when unconfigured
 * or the membership env is malformed). Never throws — every failure mode is a return value. */
export async function resolveLifecycleContext(request: NextRequest): Promise<LifecycleContext> {
  const store = resolveStore()
  if (!store) return { error: 'LIFECYCLE_STORE_UNAVAILABLE' }

  let membership: HouseholdMember[]
  try {
    membership = parseHouseholdMembership(process.env)
  } catch {
    return { error: 'LIFECYCLE_STORE_UNAVAILABLE' }
  }

  const viewer = await resolveHouseholdSessionMember(
    request.cookies.get(HOUSEHOLD_SESSION_COOKIE)?.value,
    process.env.DORANDORAN_AUTH_SECRET ?? '',
    membership,
    Date.now(),
  )
  if (!viewer) return { error: 'AUTH_REQUIRED' }

  const service = createLifecycleService({
    store,
    membership,
    now: () => new Date().toISOString(),
    newId: () => crypto.randomUUID(),
  })

  return { viewer, service }
}

/** Same-origin check for every mutating lifecycle route (POST/PATCH). Fails closed: a missing or
 * unparsable `Origin` header is denied, never treated as "no cross-origin risk". */
export function assertSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).origin === request.nextUrl.origin
  } catch {
    return false
  }
}
