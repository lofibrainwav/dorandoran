import type { FamilyBlock } from './contracts.ts'

export function mergeCalendarSourceBlocks(
  sources: FamilyBlock[][],
): FamilyBlock[] {
  const merged: FamilyBlock[] = []
  const seen = new Set<string>()

  for (const blocks of sources) {
    for (const block of blocks) {
      if (seen.has(block.id)) {
        throw new Error('DUPLICATE_CANONICAL_FAMILY_BLOCK_ID')
      }
      seen.add(block.id)
      merged.push(block)
    }
  }

  return merged
}
