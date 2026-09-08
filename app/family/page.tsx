import { FamilyPlanner } from '@/components/family-planner'
import { FamilyOperatingHero } from '@/components/family-operating-hero'
import { parseHouseholdMembership, projectOperatingPresence, resolveHouseholdHome, resolveHouseholdTimeZone, resolveUniqueChildPersonId } from '@/lib/family-os'
import { buildFamilyPlanner } from '@/lib/family-os/family-planner'
import { privateFamilySurfaceEnabled } from '@/lib/server/private-family-surface'
import { loadPrivateCalendarOperatingPerson } from '@/lib/server/private-calendar-operating-source'
import { loadPrivateCalendarTemporalGrids } from '@/lib/server/private-calendar-temporal-source'
import { loadPrivateOperationalFamilyCalendarPerson } from '@/lib/server/private-operational-family-calendar-source'
import { loadPrivatePhotoSnapshot } from '@/lib/server/private-photo-snapshot'
import { loadJdkApprovedReleases, projectLearningModuleWithApprovedReleases } from '@/lib/server/jdk-approved-releases'
import { loadJaydenLearningModule } from '@/lib/server/jdk-bridge-transport'
import { selectScheduleResult } from '@/lib/server/schedule-result-selection'

export const dynamic = 'force-dynamic'

function householdChildPersonId() {
  try { return resolveUniqueChildPersonId(parseHouseholdMembership(process.env)) } catch { return null }
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

export default async function FamilyWeekPage() {
  const privateEnabled = privateFamilySurfaceEnabled()
  const now = new Date()
  const timeZone = householdTimeZone()
  const home = householdHome()
  const childPersonId = householdChildPersonId()
  const modules = [{ id: 'schedule', label: 'Schedule' }, { id: 'school', label: 'School' }, { id: 'activities', label: 'Activities' }]
  const [operational, [local, temporal, photos], learningBase, approvedReleases] = await Promise.all([
    childPersonId ? loadPrivateOperationalFamilyCalendarPerson({ personId: childPersonId, label: 'Jayden', now, timeZone, modules }) : Promise.resolve(null),
    privateEnabled ? Promise.all([
      loadPrivateCalendarOperatingPerson({ personId: 'person-jayden', label: 'Jayden', now, timeZone, modules }),
      loadPrivateCalendarTemporalGrids({ personId: 'person-jayden', now, timeZone }),
      loadPrivatePhotoSnapshot({ now, maxAgeMs: 24 * 60 * 60 * 1000 }),
    ]) : Promise.resolve([null, null, null] as const),
    loadJaydenLearningModule(),
    loadJdkApprovedReleases(),
  ])
  const learning = projectLearningModuleWithApprovedReleases(learningBase, approvedReleases)
  const schedule = selectScheduleResult(operational, local)
  if (schedule) schedule.readModel.modules = [...schedule.readModel.modules, learning]
  const model = buildFamilyPlanner({
    observations: schedule?.householdObservations ?? [], now, timeZone,
    known: schedule?.sourceHealth === 'green', childPersonId: childPersonId ?? (privateEnabled ? 'person-jayden' : null),
  })
  const appleStatus = photos?.status === 'fresh' && photos.result?.sourceState === 'ready'
    ? '허용된 사진 메타데이터 읽음' : photos?.status === 'stale' ? '사진 스냅샷 갱신 필요' : 'Apple 메타데이터 서버 연결 전'
  return <FamilyPlanner model={model} home={home} appleStatus={appleStatus} learningStatus={learning.statusLabel ?? '학습 연결 상태 확인 필요'}>
    {schedule ? <FamilyOperatingHero person={schedule.readModel} home={home}
      presence={projectOperatingPresence({ state: 'unknown', observedAt: now.toISOString(), evidenceRefs: [] })}
      monthGrid={temporal?.monthGrid} yearGrid={temporal?.yearGrid} journey={photos?.result?.experience} /> : null}
  </FamilyPlanner>
}
