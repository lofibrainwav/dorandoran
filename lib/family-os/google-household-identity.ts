export type HouseholdRole = 'admin' | 'scheduler' | 'transport' | 'child'
export type HouseholdAccess = 'adult' | 'child'

export interface HouseholdMemberConfig {
  personId: string
  displayName?: string
  googleSub: string
  access: HouseholdAccess
  roles: HouseholdRole[]
}

export interface HouseholdMember extends HouseholdMemberConfig {
  canSignIn: boolean
}

export interface GoogleIdentityClaims {
  sub?: string | null
  email?: string | null
}

export type CalendarSubjectRuleKind = 'event' | 'series'

export interface CalendarSubjectRule {
  kind: CalendarSubjectRuleKind
  sourceId: string
  personId: string
}

export interface CalendarEventIdentity {
  id?: unknown
  recurringEventId?: unknown
  summary?: unknown
}

const HOUSEHOLD_ROLES = new Set<HouseholdRole>(['admin', 'scheduler', 'transport', 'child'])
const HOUSEHOLD_ACCESS = new Set<HouseholdAccess>(['adult', 'child'])
const SUBJECT_RULE_KINDS = new Set<CalendarSubjectRuleKind>(['event', 'series'])

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseJsonArray(raw: string | undefined, errorCode: string): unknown[] {
  const value = raw?.trim()
  if (!value) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error(errorCode)
  }
  if (!Array.isArray(parsed)) throw new Error(errorCode)
  return parsed
}

export function parseHouseholdMembership(
  env: Record<string, string | undefined>,
): HouseholdMember[] {
  const rows = parseJsonArray(env.DORANDORAN_HOUSEHOLD_MEMBERS_JSON, 'INVALID_HOUSEHOLD_MEMBERS_JSON')
  const people = new Set<string>()
  const subjects = new Set<string>()

  return rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('INVALID_HOUSEHOLD_MEMBER')
    }
    const record = row as Record<string, unknown>
    const personId = clean(record.personId)
    const displayName = clean(record.displayName)
    const googleSub = clean(record.googleSub)
    const access = clean(record.access) as HouseholdAccess | null
    const rawRoles = record.roles

    if (!personId || !googleSub || !access || !HOUSEHOLD_ACCESS.has(access) || !Array.isArray(rawRoles)) {
      throw new Error('INVALID_HOUSEHOLD_MEMBER')
    }
    if (people.has(personId)) throw new Error('DUPLICATE_HOUSEHOLD_PERSON')
    if (subjects.has(googleSub)) throw new Error('DUPLICATE_GOOGLE_SUB')

    const roles = rawRoles.map((role) => clean(role) as HouseholdRole | null)
    if (!roles.length || roles.some((role) => !role || !HOUSEHOLD_ROLES.has(role))) {
      throw new Error('INVALID_HOUSEHOLD_ROLE')
    }

    people.add(personId)
    subjects.add(googleSub)
    return {
      personId,
      ...(displayName ? { displayName } : {}),
      googleSub,
      access,
      roles: roles as HouseholdRole[],
      canSignIn: access === 'adult',
    }
  })
}

export function parseHouseholdDisplayNames(
  env: Record<string, string | undefined>,
): Record<string, string> {
  const raw = env.DORANDORAN_HOUSEHOLD_DISPLAY_NAMES_JSON?.trim()
  if (!raw) return {}
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('INVALID_HOUSEHOLD_DISPLAY_NAMES_JSON') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('INVALID_HOUSEHOLD_DISPLAY_NAMES_JSON')
  const result: Record<string, string> = {}
  for (const [personId, value] of Object.entries(parsed)) {
    const cleanPersonId = clean(personId)
    const displayName = clean(value)
    if (!cleanPersonId || !displayName) throw new Error('INVALID_HOUSEHOLD_DISPLAY_NAME')
    result[cleanPersonId] = displayName
  }
  return result
}

export function resolveHouseholdMember(
  claims: GoogleIdentityClaims,
  membership: HouseholdMember[],
): HouseholdMember | null {
  const googleSub = clean(claims.sub)
  if (!googleSub) return null
  return membership.find((member) => member.googleSub === googleSub) ?? null
}

export function resolveUniqueChildPersonId(membership: HouseholdMember[]): string | null {
  const children = membership.filter((member) => member.access === 'child')
  return children.length === 1 ? children[0].personId : null
}

export function resolveOperationalFamilyCalendar(
  env: Record<string, string | undefined>,
): string | null {
  return clean(env.DORANDORAN_FAMILY_CALENDAR_ID)
}

export function parseCalendarSubjectRules(
  env: Record<string, string | undefined>,
): CalendarSubjectRule[] {
  const rows = parseJsonArray(
    env.DORANDORAN_CALENDAR_SUBJECT_RULES_JSON,
    'INVALID_CALENDAR_SUBJECT_RULES_JSON',
  )
  const keys = new Set<string>()

  return rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('INVALID_CALENDAR_SUBJECT_RULE')
    }
    const record = row as Record<string, unknown>
    const kind = clean(record.kind) as CalendarSubjectRuleKind | null
    const sourceId = clean(record.sourceId)
    const personId = clean(record.personId)
    if (!kind || !SUBJECT_RULE_KINDS.has(kind) || !sourceId || !personId) {
      throw new Error('INVALID_CALENDAR_SUBJECT_RULE')
    }
    const key = `${kind}:${sourceId}`
    if (keys.has(key)) throw new Error('DUPLICATE_CALENDAR_SUBJECT_RULE')
    keys.add(key)
    return { kind, sourceId, personId }
  })
}

export function resolveCalendarEventSubject(
  event: CalendarEventIdentity,
  rules: CalendarSubjectRule[],
): string | null {
  const eventId = clean(event.id)
  if (eventId) {
    const exact = rules.find((rule) => rule.kind === 'event' && rule.sourceId === eventId)
    if (exact) return exact.personId
  }

  const recurringEventId = clean(event.recurringEventId)
  if (recurringEventId) {
    const series = rules.find((rule) => rule.kind === 'series' && rule.sourceId === recurringEventId)
    if (series) return series.personId
  }

  return null
}
