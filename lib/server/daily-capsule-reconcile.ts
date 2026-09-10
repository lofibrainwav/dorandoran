import { createFamilyDailyCapsule } from '../family-os/daily-capsule.ts'
import { deriveCandidateState, type CandidateState } from '../family-os/lifecycle.ts'
import { createPostgresDailyCapsuleStore, type DailyCapsuleQuery } from './daily-capsule-store.ts'

const EMPTY_ARTIFACT_REGISTRY = { version: 1 as const, artifacts: [], conflicts: [] }
const UTC_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })

function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

function previousLocalDate(nowIso: string, timeZone: string): string {
  const current = localDate(nowIso, timeZone)
  const [year, month, day] = current.split('-').map(Number)
  return UTC_DATE.format(new Date(Date.UTC(year, month - 1, day) - 86_400_000))
}

function parseObject(value: unknown): Record<string, unknown> {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('DAILY_CAPSULE_JSON_INVALID')
  return parsed as Record<string, unknown>
}

function candidateState(row: Record<string, unknown>, nowIso: string): CandidateState {
  const opportunity = parseObject(row.opportunity)
  const decision = row.decision === null || row.decision === undefined ? undefined : parseObject(row.decision)
  return deriveCandidateState({ ...opportunity, ...(decision ? { decision } : {}) } as never, {
    nowIso,
    createdAtIso: String(row.created_at),
  })
}

/** 이미 승인된 family 범위 lifecycle 사실만 봉인하며 Task를 만들지 않는다. */
export async function reconcileAndPersistDailyCapsule(input: {
  query: DailyCapsuleQuery
  householdKey: string
  nowIso: string
  timeZone: string
  date?: string
}) {
  const date = input.date ?? previousLocalDate(input.nowIso, input.timeZone)
  const [captures, candidates, tasks] = await Promise.all([
    input.query(
      `SELECT kind FROM lifecycle_capture
        WHERE privacy_scope = 'family'
          AND (captured_at AT TIME ZONE $1)::date = $2::date`,
      [input.timeZone, date],
    ),
    input.query(
      `SELECT opportunity, decision, created_at FROM lifecycle_candidate
        WHERE privacy_scope = 'family'
          AND (created_at AT TIME ZONE $1)::date = $2::date`,
      [input.timeZone, date],
    ),
    input.query(
      `SELECT work_state FROM lifecycle_task
        WHERE privacy_scope = 'family'
          AND ((created_at AT TIME ZONE $1)::date = $2::date
            OR (updated_at AT TIME ZONE $1)::date = $2::date)`,
      [input.timeZone, date],
    ),
  ])
  const capsule = createFamilyDailyCapsule({
    date,
    artifactRegistry: EMPTY_ARTIFACT_REGISTRY,
    captures: captures.rows.map((row) => ({ kind: row.kind as never })),
    candidates: candidates.rows.map((row) => ({ state: candidateState(row, input.nowIso) })),
    tasks: tasks.rows.map((row) => ({ workState: row.work_state as never })),
  })
  await createPostgresDailyCapsuleStore({ query: input.query }).save({
    householdKey: input.householdKey,
    date,
    capsule,
    generatedAt: input.nowIso,
  })
  return capsule
}
