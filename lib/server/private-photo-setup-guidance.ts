import type { PrivatePhotoJourneyResult } from './private-photo-journey-source.ts'

export interface PrivatePhotoSetupGuidance {
  state: 'ready' | 'action-required' | 'failure'
  title: string
  detail: string
  action: 'create-designated-album' | 'check-photo-source' | null
}

export function projectPrivatePhotoSetupGuidance(
  result: PrivatePhotoJourneyResult | null,
  input: { albumName?: string },
): PrivatePhotoSetupGuidance | null {
  if (!result) return null
  if (result.sourceState === 'album-missing') {
    const albumName = input.albumName?.trim() || 'configured album'
    return {
      state: 'action-required',
      title: 'Photos setup required',
      detail: `Create the ${albumName} album in Photos, then add only approved memories.`,
      action: 'create-designated-album',
    }
  }
  if (result.sourceState === 'failure') {
    return {
      state: 'failure',
      title: 'Photos source needs attention',
      detail: 'Photo metadata could not be read. No memories were invented.',
      action: 'check-photo-source',
    }
  }
  const count = result.selectedCount
  return {
    state: 'ready',
    title: 'Photos ready',
    detail: `${count} ${count === 1 ? 'memory' : 'memories'} available from the configured private source.`,
    action: null,
  }
}
