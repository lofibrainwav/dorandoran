import test from 'node:test'
import assert from 'node:assert/strict'
import { projectFamilyCoordination } from '../../lib/family-os/index.ts'

function block(id, start, end, physicalOwnerIds = []) {
  return {
    id,
    type: 'event',
    reality: { title: id, start, end },
    evidenceRefs: [`evidence:${id}`],
    evidenceState: 'confirmed',
    people: { subjectIds: [], physicalOwnerIds, approverIds: [], recipientIds: [] },
    digital: { jobs: [] },
    timeEngine: { protected: true },
    dependencyIds: [], childBlockIds: [], workState: 'open',
  }
}

const anchor = block('anchor-event', '2026-09-08T15:00:00-07:00', '2026-09-08T16:00:00-07:00')
const shared = block('shared-event', '2026-09-09T15:00:00-07:00', '2026-09-09T16:00:00-07:00')
const supporter = block('supporter-event', '2026-09-08T15:30:00-07:00', '2026-09-08T16:30:00-07:00')

test('anchor personal and coordination shared form the family timeline while supporter personal stays a constraint', () => {
  const result = projectFamilyCoordination([
    { sourceKey: 'child-primary', role: 'anchor_personal', personId: 'child', blocks: [anchor] },
    { sourceKey: 'family-ops', role: 'coordination_shared', blocks: [shared] },
    { sourceKey: 'parent-primary', role: 'supporter_personal', personId: 'parent', blocks: [supporter] },
  ], { anchorPersonId: 'child' })

  assert.deepEqual(result.familyTimelineRefs.map((ref) => ref.blockId), ['anchor-event', 'shared-event'])
  assert.deepEqual(result.personalConstraintRefs.map((ref) => ref.blockId), ['supporter-event'])
})

test('overlap becomes a conflict only when the supporter is an explicit physical owner', () => {
  const required = block('required-event', '2026-09-08T15:00:00-07:00', '2026-09-08T16:00:00-07:00', ['parent'])
  const result = projectFamilyCoordination([
    { sourceKey: 'child-primary', role: 'anchor_personal', personId: 'child', blocks: [required] },
    { sourceKey: 'parent-primary', role: 'supporter_personal', personId: 'parent', blocks: [supporter] },
  ], { anchorPersonId: 'child' })

  assert.equal(result.conflicts.length, 1)
  assert.equal(result.conflicts[0].kind, 'physical_owner_overlap')
})

test('unrelated supporter overlap does not create a conflict', () => {
  const result = projectFamilyCoordination([
    { sourceKey: 'child-primary', role: 'anchor_personal', personId: 'child', blocks: [anchor] },
    { sourceKey: 'parent-primary', role: 'supporter_personal', personId: 'parent', blocks: [supporter] },
  ], { anchorPersonId: 'child' })

  assert.deepEqual(result.conflicts, [])
})

test('anchor source must belong to the configured anchor person', () => {
  assert.throws(() => projectFamilyCoordination([
    { sourceKey: 'child-primary', role: 'anchor_personal', personId: 'parent', blocks: [anchor] },
  ], { anchorPersonId: 'child' }), /ANCHOR_PERSON_MISMATCH/)
})

test('supplemental personal sources stay out of family truth', () => {
  const result = projectFamilyCoordination([
    { sourceKey: 'child-primary', role: 'anchor_personal', personId: 'child', blocks: [anchor] },
    { sourceKey: 'parent-primary', role: 'supporter_personal', personId: 'parent', blocks: [supporter] },
  ], { anchorPersonId: 'child' })

  assert.equal(result.familyTimelineRefs.some((ref) => ref.blockId === 'supporter-event'), false)
  assert.deepEqual(result.personalConstraintRefs.map((ref) => ref.blockId), ['supporter-event'])
})
