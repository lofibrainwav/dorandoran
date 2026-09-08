import type { HouseholdMember } from './google-household-identity.ts'

export type HouseholdResponsibility = 'scheduler' | 'transport'
export type ResponsibilityOverrideKind = 'event' | 'series'

export interface HouseholdResponsibilityDefaults {
  schedulerPersonId: string | null
  transportPersonId: string | null
}

export interface ResponsibilityOverride {
  kind: ResponsibilityOverrideKind
  sourceId: string
  responsibility: HouseholdResponsibility
  personId: string
}

const OVERRIDE_KINDS = new Set<ResponsibilityOverrideKind>(['event', 'series'])
const RESPONSIBILITIES = new Set<HouseholdResponsibility>(['scheduler', 'transport'])

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function uniqueAdultForRole(membership: HouseholdMember[], role: HouseholdResponsibility): string | null {
  const candidates = membership.filter((member) => member.access === 'adult' && member.roles.includes(role))
  return candidates.length === 1 ? candidates[0].personId : null
}

export function resolveHouseholdResponsibilityDefaults(
  membership: HouseholdMember[],
): HouseholdResponsibilityDefaults {
  return {
    schedulerPersonId: uniqueAdultForRole(membership, 'scheduler'),
    transportPersonId: uniqueAdultForRole(membership, 'transport'),
  }
}

export function parseResponsibilityOverrides(
  env: Record<string, string | undefined>,
): ResponsibilityOverride[] {
  const raw = env.DORANDORAN_RESPONSIBILITY_OVERRIDES_JSON?.trim()
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('INVALID_RESPONSIBILITY_OVERRIDES_JSON')
  }
  if (!Array.isArray(parsed)) throw new Error('INVALID_RESPONSIBILITY_OVERRIDES_JSON')

  const keys = new Set<string>()
  return parsed.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('INVALID_RESPONSIBILITY_OVERRIDE')
    }
    const record = row as Record<string, unknown>
    const kind = clean(record.kind) as ResponsibilityOverrideKind | null
    const sourceId = clean(record.sourceId)
    const responsibility = clean(record.responsibility) as HouseholdResponsibility | null
    const personId = clean(record.personId)
    if (
      !kind || !OVERRIDE_KINDS.has(kind) || !sourceId ||
      !responsibility || !RESPONSIBILITIES.has(responsibility) || !personId
    ) {
      throw new Error('INVALID_RESPONSIBILITY_OVERRIDE')
    }
    const key = `${kind}:${sourceId}:${responsibility}`
    if (keys.has(key)) throw new Error('DUPLICATE_RESPONSIBILITY_OVERRIDE')
    keys.add(key)
    return { kind, sourceId, responsibility, personId }
  })
}

export function resolveEventResponsibility(input: {
  responsibility: HouseholdResponsibility
  eventId?: unknown
  recurringEventId?: unknown
  defaults: HouseholdResponsibilityDefaults
  overrides: ResponsibilityOverride[]
  membership?: HouseholdMember[]
}): string | null {
  const eventId = clean(input.eventId)
  const recurringEventId = clean(input.recurringEventId)

  const exact = eventId
    ? input.overrides.find((override) =>
        override.kind === 'event' &&
        override.sourceId === eventId &&
        override.responsibility === input.responsibility)
    : undefined
  const series = !exact && recurringEventId
    ? input.overrides.find((override) =>
        override.kind === 'series' &&
        override.sourceId === recurringEventId &&
        override.responsibility === input.responsibility)
    : undefined
  const selected = exact ?? series

  if (selected) {
    if (input.membership && !input.membership.some((member) => member.personId === selected.personId)) {
      throw new Error('RESPONSIBILITY_OVERRIDE_MEMBER_UNKNOWN')
    }
    return selected.personId
  }

  return input.responsibility === 'scheduler'
    ? input.defaults.schedulerPersonId
    : input.defaults.transportPersonId
}
