import { FamilyPlanner } from '@/components/family-planner'
import { FamilyOperatingHero } from '@/components/family-operating-hero'
import { LifecycleLaneBridge } from '@/components/lifecycle-lane-bridge'
import { cookies } from 'next/headers'
import { parseHouseholdDisplayNames, parseHouseholdMembership, projectOperatingPresence, resolveHouseholdHome, resolveHouseholdTimeZone, resolveUniqueChildPersonId, weekWindowFromLocalDate, weekWindowFromLocalWeekStart, type HouseholdMember } from '@/lib/family-os'
import { buildFamilyPlanner } from '@/lib/family-os/family-planner'
import { HOUSEHOLD_SESSION_COOKIE, resolveHouseholdSessionMember } from '@/lib/server/google-household-session'
import { privateFamilySurfaceEnabled } from '@/lib/server/private-family-surface'
import { loadPrivateCalendarOperatingPerson } from '@/lib/server/private-calendar-operating-source'
import { loadPrivateCalendarTemporalGrids } from '@/lib/server/private-calendar-temporal-source'
import { loadPrivateOperationalFamilyCalendarPerson } from '@/lib/server/private-operational-family-calendar-source'
import { loadPrivatePhotoSnapshot } from '@/lib/server/private-photo-snapshot'
import { loadApplePhotoMetadataProjection } from '@/lib/server/apple-photo-metadata-read'
import { loadGoogleDrivePhotoSnapshot } from '@/lib/server/google-drive-photo-snapshot'
import { loadJdkApprovedReleases, projectLearningModuleWithApprovedReleases } from '@/lib/server/jdk-approved-releases'
import { loadJaydenLearningModule } from '@/lib/server/jdk-bridge-transport'
import { selectScheduleResult } from '@/lib/server/schedule-result-selection'

export const dynamic = 'force-dynamic'

function householdChildPersonId() {
  try { return resolveUniqueChildPersonId(parseHouseholdMembership(process.env)) } catch { return null }
}
function householdMembers(): HouseholdMember[] {
  try { return parseHouseholdMembership(process.env) } catch { return [] }
}
function lifecycleLaneLabel(personId: string): string {
  return personId.charAt(0).toUpperCase() + personId.slice(1)
}
async function resolveLifecycleViewer(membership: HouseholdMember[]): Promise<HouseholdMember | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(HOUSEHOLD_SESSION_COOKIE)?.value
    return await resolveHouseholdSessionMember(token, process.env.DORANDORAN_AUTH_SECRET ?? '', membership, Date.now())
  } catch {
    return null
  }
}
function householdHome() {
  try { return resolveHouseholdHome(process.env) } catch {
    console.error('[family-week] Invalid home configuration; using default view')
    return resolveHouseholdHome({})
  }
}
function householdTimeZone() {
  try { return resolveHouseholdTimeZone(process.env) } catch {
    console.error('[family-week] Invalid timezone; using default zone')
    return resolveHouseholdTimeZone({})
  }
}

export default async function FamilyWeekPage({ searchParams }: { searchParams?: Promise<{ week?: string }> }) {
  const privateEnabled = privateFamilySurfaceEnabled()
  const now = new Date()
  const timeZone = householdTimeZone()
  const requestedWeek = (await searchParams)?.week?.trim()
  let weekStartDate: string | undefined
  try {
    weekStartDate = requestedWeek
      ? weekWindowFromLocalWeekStart(requestedWeek, timeZone).weekStartDate
      : weekWindowFromLocalDate(now, timeZone).weekStartDate
  } catch {
    weekStartDate = weekWindowFromLocalDate(now, timeZone).weekStartDate
  }
  const home = householdHome()
  const childPersonId = householdChildPersonId()
  const membership = householdMembers()
  const calendarPersonId = childPersonId
  let configuredDisplayNames: Record<string, string> = {}
  try { configuredDisplayNames = parseHouseholdDisplayNames(process.env) } catch { console.error('[family-week] Invalid display-name configuration; using membership labels') }
  const memberLabels = Object.fromEntries(membership.map((member) => [member.personId, configuredDisplayNames[member.personId] ?? member.displayName ?? lifecycleLaneLabel(member.personId)]))
  const modules = [{ id: 'schedule', label: 'Schedule' }, { id: 'school', label: 'School' }, { id: 'activities', label: 'Activities' }]
  const photoSnapshot = privateEnabled
    ? loadPrivatePhotoSnapshot({ now, maxAgeMs: 24 * 60 * 60 * 1000 })
    : loadGoogleDrivePhotoSnapshot({ now, maxAgeMs: 24 * 60 * 60 * 1000 })
  const [operational, [local, temporal, photos, applePhotoMetadata], learningBase, approvedReleases, lifecycleViewerMember] = await Promise.all([
    childPersonId ? loadPrivateOperationalFamilyCalendarPerson({ personId: childPersonId, label: memberLabels[childPersonId] ?? lifecycleLaneLabel(childPersonId), now, timeZone, weekStartDate, modules }) : Promise.resolve(null),
    Promise.all([
      privateEnabled && calendarPersonId ? loadPrivateCalendarOperatingPerson({ personId: calendarPersonId, label: memberLabels[calendarPersonId] ?? lifecycleLaneLabel(calendarPersonId), now, timeZone, weekStartDate, modules }) : Promise.resolve(null),
      privateEnabled && calendarPersonId ? loadPrivateCalendarTemporalGrids({ personId: calendarPersonId, now, timeZone }) : Promise.resolve(null),
      photoSnapshot,
      loadApplePhotoMetadataProjection({ now, maxAgeMs: 24 * 60 * 60 * 1000 }),
    ]),
    loadJaydenLearningModule(),
    loadJdkApprovedReleases(),
    resolveLifecycleViewer(membership),
  ])
  const lifecycleMembers = membership.map((member) => ({
    personId: member.personId,
    access: member.access,
    label: memberLabels[member.personId] ?? lifecycleLaneLabel(member.personId),
  }))
  const learning = projectLearningModuleWithApprovedReleases(learningBase, approvedReleases)
  const schedule = selectScheduleResult(operational, local)
  if (schedule) schedule.readModel.modules = [...schedule.readModel.modules, learning]
  const model = buildFamilyPlanner({
    observations: schedule?.householdObservations ?? [], now, timeZone,
    known: schedule?.sourceHealth === 'green', childPersonId, weekStartDate,
  })
  const appleMetadataLive = applePhotoMetadata?.status === 'live'
  const appleJourney = appleMetadataLive ? applePhotoMetadata.experience : photos?.result?.experience
  const appleStatus = appleMetadataLive
    ? `허용된 사진 메타데이터 읽음 · ${applePhotoMetadata.selectedCount}건`
    : photos?.status === 'fresh' && photos.result?.sourceState === 'ready'
    ? `허용된 사진 메타데이터 읽음 · ${photos.result.selectedCount}건`
    : photos?.status === 'stale' ? '사진 스냅샷 갱신 필요'
      : photos?.status === 'invalid' ? '사진 스냅샷을 확인할 수 없음'
        : 'Apple Photos handoff 설정 전'
  return <FamilyPlanner model={model} home={home} memberLabels={memberLabels} appleStatus={appleStatus} learningStatus={learning.statusLabel ?? '학습 연결 상태 확인 필요'}
    lifecycleViewer={lifecycleViewerMember ? { personId: lifecycleViewerMember.personId, access: lifecycleViewerMember.access } : null}>
    {schedule ? <FamilyOperatingHero person={schedule.readModel} home={home}
      presence={projectOperatingPresence({ state: 'unknown', observedAt: now.toISOString(), evidenceRefs: [] })}
      monthGrid={temporal?.monthGrid} yearGrid={temporal?.yearGrid} journey={appleJourney} /> : null}
    <LifecycleLaneBridge
      initialViewer={lifecycleViewerMember ? { personId: lifecycleViewerMember.personId, access: lifecycleViewerMember.access } : null}
      members={lifecycleMembers}
    />
  </FamilyPlanner>
}
