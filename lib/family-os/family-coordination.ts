import type { FamilyBlock } from './contracts.ts'

export type FamilyCoordinationRole =
  | 'anchor_personal'
  | 'coordination_shared'
  | 'supporter_personal'

export interface FamilyCoordinationSource {
  sourceKey: string
  role: FamilyCoordinationRole
  personId?: string
  blocks: FamilyBlock[]
}

export interface FamilyCoordinationOptions {
  anchorPersonId: string
}

export interface FamilyCoordinationRef {
  sourceKey: string
  blockId: string
}

export interface FamilyCoordinationConflict {
  kind: 'physical_owner_overlap'
  supporterPersonId: string
  familyBlockRef: FamilyCoordinationRef
  supporterBlockRef: FamilyCoordinationRef
}

export interface FamilyCoordinationProjection {
  familyTimelineRefs: FamilyCoordinationRef[]
  personalConstraintRefs: FamilyCoordinationRef[]
  conflicts: FamilyCoordinationConflict[]
}

function requireNonEmpty(value: string | undefined, errorCode: string): string {
  if (!value?.trim()) throw new Error(errorCode)
  return value.trim()
}

function sourceRef(source: FamilyCoordinationSource, block: FamilyBlock): FamilyCoordinationRef {
  return { sourceKey: source.sourceKey, blockId: block.id }
}

function interval(block: FamilyBlock): { start: number; end: number } | undefined {
  if (!block.reality.start || !block.reality.end) return undefined
  const start = Date.parse(block.reality.start)
  const end = Date.parse(block.reality.end)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined
  return { start, end }
}

function overlaps(left: FamilyBlock, right: FamilyBlock): boolean {
  const leftInterval = interval(left)
  const rightInterval = interval(right)
  if (!leftInterval || !rightInterval) return false
  return leftInterval.start < rightInterval.end && rightInterval.start < leftInterval.end
}

export function projectFamilyCoordination(
  sources: FamilyCoordinationSource[],
  options: FamilyCoordinationOptions,
): FamilyCoordinationProjection {
  const anchorPersonId = requireNonEmpty(options.anchorPersonId, 'ANCHOR_PERSON_ID_MISSING')
  const anchorSources = sources.filter((source) => source.role === 'anchor_personal')
  if (anchorSources.length !== 1) throw new Error('ANCHOR_SOURCE_COUNT_INVALID')

  const anchorSource = anchorSources[0]
  if (requireNonEmpty(anchorSource.personId, 'ANCHOR_PERSON_ID_MISSING') !== anchorPersonId) {
    throw new Error('ANCHOR_PERSON_MISMATCH')
  }

  const familySources = sources.filter(
    (source) => source.role === 'anchor_personal' || source.role === 'coordination_shared',
  )
  const supporterSources = sources.filter((source) => source.role === 'supporter_personal')
  const familyTimelineRefs = familySources.flatMap((source) => source.blocks.map((block) => sourceRef(source, block)))
  const personalConstraintRefs = supporterSources.flatMap((source) => source.blocks.map((block) => sourceRef(source, block)))
  const conflicts: FamilyCoordinationConflict[] = []

  for (const supporterSource of supporterSources) {
    const supporterPersonId = requireNonEmpty(supporterSource.personId, 'SUPPORTER_PERSON_ID_MISSING')
    for (const familySource of familySources) {
      for (const familyBlock of familySource.blocks) {
        if (!familyBlock.people.physicalOwnerIds.includes(supporterPersonId)) continue
        for (const supporterBlock of supporterSource.blocks) {
          if (!overlaps(familyBlock, supporterBlock)) continue
          conflicts.push({
            kind: 'physical_owner_overlap',
            supporterPersonId,
            familyBlockRef: sourceRef(familySource, familyBlock),
            supporterBlockRef: sourceRef(supporterSource, supporterBlock),
          })
        }
      }
    }
  }

  return { familyTimelineRefs, personalConstraintRefs, conflicts }
}
