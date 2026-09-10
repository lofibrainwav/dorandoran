import type { FamilyDailyCapsule } from '../family-os/daily-capsule.ts'

export type DailyCapsuleQueryResult = { rows: Record<string, unknown>[]; rowCount: number | null }
export type DailyCapsuleQuery = (text: string, params?: unknown[]) => Promise<DailyCapsuleQueryResult>

function required(value: string, code: string): string {
  const result = value.trim()
  if (!result) throw new Error(code)
  return result
}

function date(value: string): string {
  const result = required(value, 'DAILY_CAPSULE_DATE_REQUIRED')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(`${result}T00:00:00Z`))) {
    throw new Error('DAILY_CAPSULE_DATE_INVALID')
  }
  return result
}

function parseCapsule(value: unknown): FamilyDailyCapsule | null {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const capsule = parsed as Partial<FamilyDailyCapsule>
  if (capsule.version !== 1 || typeof capsule.date !== 'string') return null
  return capsule as FamilyDailyCapsule
}

export interface DailyCapsuleStore {
  save(input: { householdKey: string; date: string; capsule: FamilyDailyCapsule; generatedAt: string }): Promise<void>
  get(input: { householdKey: string; date: string }): Promise<{ capsule: FamilyDailyCapsule; generatedAt: string } | null>
}

export function createPostgresDailyCapsuleStore(input: { query: DailyCapsuleQuery }): DailyCapsuleStore {
  return {
    async save(value) {
      const householdKey = required(value.householdKey, 'DAILY_CAPSULE_HOUSEHOLD_REQUIRED')
      const capsuleDate = date(value.date)
      const generatedAt = required(value.generatedAt, 'DAILY_CAPSULE_GENERATED_AT_REQUIRED')
      if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('DAILY_CAPSULE_GENERATED_AT_INVALID')
      await input.query(
        `INSERT INTO family_daily_capsule
          (household_key, capsule_date, version, capsule, generated_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $5)
         ON CONFLICT (household_key, capsule_date) DO UPDATE SET
           version = EXCLUDED.version,
           capsule = EXCLUDED.capsule,
           generated_at = EXCLUDED.generated_at,
           updated_at = EXCLUDED.updated_at`,
        [householdKey, capsuleDate, value.capsule.version, JSON.stringify(value.capsule), generatedAt],
      )
    },

    async get(value) {
      const householdKey = required(value.householdKey, 'DAILY_CAPSULE_HOUSEHOLD_REQUIRED')
      const capsuleDate = date(value.date)
      const result = await input.query(
        `SELECT capsule, generated_at
           FROM family_daily_capsule
          WHERE household_key = $1 AND capsule_date = $2`,
        [householdKey, capsuleDate],
      )
      const row = result.rows[0]
      if (!row) return null
      const capsule = parseCapsule(row.capsule)
      const generatedAt = row.generated_at instanceof Date ? row.generated_at.toISOString() : row.generated_at
      if (!capsule || typeof generatedAt !== 'string' || !Number.isFinite(Date.parse(generatedAt))) {
        throw new Error('DAILY_CAPSULE_ROW_INVALID')
      }
      return { capsule, generatedAt }
    },
  }
}
